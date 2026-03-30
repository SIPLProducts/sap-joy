import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as base64Encode } from "https://deno.land/std@0.208.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Password policy validation
function validatePasswordPolicy(password: string): { valid: boolean; error?: string } {
  if (password.length < 8) return { valid: false, error: "Password must be at least 8 characters" };
  if (password.length > 10) return { valid: false, error: "Password must not exceed 10 characters" };
  if (!/[a-zA-Z]/.test(password)) return { valid: false, error: "Password must contain at least one letter" };
  if (!/\d/.test(password)) return { valid: false, error: "Password must contain at least one number" };
  return { valid: true };
}

// Simple hash for password history (not for auth, just comparison)
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + "mrb_pw_salt_v1");
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = new Uint8Array(hashBuffer);
  return base64Encode(hashArray);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify the calling user is an admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: callingUser }, error: authError } = await anonClient.auth.getUser();
    if (authError || !callingUser) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if calling user is admin
    const { data: roleData } = await anonClient.from("user_roles").select("role").eq("user_id", callingUser.id).maybeSingle();
    if (roleData?.role !== "admin") {
      return new Response(JSON.stringify({ error: "Only admins can manage users" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action } = body;

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // ─── UPDATE USER (role, department, password) ───
    if (action === "update_user") {
      const { user_id, role, department, plant, new_password } = body;

      if (!user_id) {
        return new Response(JSON.stringify({ error: "Missing user_id" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Update password if provided
      if (new_password) {
        // Validate password policy
        const policyCheck = validatePasswordPolicy(new_password);
        if (!policyCheck.valid) {
          return new Response(JSON.stringify({ error: policyCheck.error }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Check password reuse (last 4 passwords)
        const pwHash = await hashPassword(new_password);
        const { data: historyRecords } = await adminClient
          .from("password_history")
          .select("password_hash")
          .eq("user_id", user_id)
          .order("changed_at", { ascending: false })
          .limit(4);

        if (historyRecords?.some(h => h.password_hash === pwHash)) {
          return new Response(JSON.stringify({ error: "Cannot reuse any of your last 4 passwords. Please choose a different password." }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { error: pwError } = await adminClient.auth.admin.updateUserById(user_id, {
          password: new_password,
        });
        if (pwError) {
          return new Response(JSON.stringify({ error: `Password update failed: ${pwError.message}` }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Record password in history
        await adminClient.from("password_history").insert({
          user_id,
          password_hash: pwHash,
        });

        // Update last password change date in user_security
        await adminClient.from("user_security").upsert({
          user_id,
          last_password_change: new Date().toISOString(),
          failed_login_attempts: 0,
          locked_until: null,
        }, { onConflict: "user_id" });
      }

      // Update profile (department, plant)
      if (department !== undefined || plant !== undefined) {
        const updates: Record<string, string | null> = {};
        if (department !== undefined) updates.department = department || null;
        if (plant !== undefined) updates.plant = plant || null;

        await adminClient.from("profiles").update(updates).eq("user_id", user_id);
      }

      // Update role if provided
      if (role) {
        const { data: existingRole } = await adminClient
          .from("user_roles")
          .select("id")
          .eq("user_id", user_id)
          .maybeSingle();

        if (existingRole) {
          await adminClient.from("user_roles").update({ role }).eq("user_id", user_id);
        } else {
          await adminClient.from("user_roles").insert({ user_id, role });
        }
      }

      return new Response(
        JSON.stringify({ success: true, message: "User updated successfully" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── CREATE USER (default action) ───
    const { email, password, full_name, role, department, plant } = body;

    if (!email || !password || !full_name || !role) {
      return new Response(JSON.stringify({ error: "Missing required fields: email, password, full_name, role" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate password policy
    const policyCheck = validatePasswordPolicy(password);
    if (!policyCheck.valid) {
      return new Response(JSON.stringify({ error: policyCheck.error }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name },
    });

    if (createError) {
      return new Response(JSON.stringify({ error: createError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = newUser.user.id;

    await adminClient.from("profiles").update({
      department: department || null,
      plant: plant || null,
    }).eq("user_id", userId);

    const { error: roleError } = await adminClient.from("user_roles").insert({
      user_id: userId,
      role,
    });

    if (roleError) {
      console.error("Role assignment error:", roleError);
    }

    // Record initial password in history
    const pwHash = await hashPassword(password);
    await adminClient.from("password_history").insert({
      user_id: userId,
      password_hash: pwHash,
    });

    // Create user_security record
    await adminClient.from("user_security").insert({
      user_id: userId,
      last_password_change: new Date().toISOString(),
    });

    return new Response(
      JSON.stringify({ success: true, user_id: userId, message: `User ${email} created successfully` }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
