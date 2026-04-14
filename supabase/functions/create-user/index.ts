import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as base64Encode } from "https://deno.land/std@0.208.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// All responses use HTTP 200 to prevent Supabase JS SDK from swallowing error details.
function jsonResponse(body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

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
      return jsonResponse({ ok: false, error: "No authorization header" });
    }

    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: callingUser }, error: authError } = await anonClient.auth.getUser();
    if (authError || !callingUser) {
      return jsonResponse({ ok: false, error: "Unauthorized" });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Check if calling user is admin OR has user_management screen access
    const { data: roleData } = await anonClient.from("user_roles").select("role").eq("user_id", callingUser.id).maybeSingle();
    const isAdmin = roleData?.role === "admin";

    let hasUserMgmtAccess = false;
    if (!isAdmin && roleData?.role) {
      const { data: permData } = await adminClient.from("role_permissions")
        .select("can_view")
        .eq("role", roleData.role)
        .eq("module_key", "user_management")
        .eq("can_view", true)
        .maybeSingle();
      hasUserMgmtAccess = !!permData;
    }

    if (!isAdmin && !hasUserMgmtAccess) {
      return jsonResponse({ ok: false, error: "Only admins can manage users" });
    }

    const body = await req.json();
    const { action } = body;

    // ─── DELETE USER ───
    if (action === "delete_user") {
      const { user_id } = body;
      if (!user_id) {
        return jsonResponse({ ok: false, error: "Missing user_id" });
      }

      // Clean up related tables first (using admin client to bypass RLS)
      await adminClient.from("password_history").delete().eq("user_id", user_id);
      await adminClient.from("user_security").delete().eq("user_id", user_id);
      await adminClient.from("user_plants").delete().eq("user_id", user_id);
      await adminClient.from("user_roles").delete().eq("user_id", user_id);
      await adminClient.from("profiles").delete().eq("user_id", user_id);

      // Delete the auth user
      const { error: deleteError } = await adminClient.auth.admin.deleteUser(user_id);
      if (deleteError) {
        return jsonResponse({ ok: false, error: `Failed to delete user: ${deleteError.message}` });
      }

      return jsonResponse({ ok: true, message: "User deleted successfully" });
    }

    // ─── UPDATE USER (role, department, password) ───
    if (action === "update_user") {
      const { user_id, role, department, plant, new_password } = body;

      if (!user_id) {
        return jsonResponse({ ok: false, error: "Missing user_id" });
      }

      // Update password if provided
      if (new_password) {
        const policyCheck = validatePasswordPolicy(new_password);
        if (!policyCheck.valid) {
          return jsonResponse({ ok: false, error: policyCheck.error });
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
          return jsonResponse({ ok: false, error: "Cannot reuse any of your last 4 passwords. Please choose a different password." });
        }

        const { error: pwError } = await adminClient.auth.admin.updateUserById(user_id, {
          password: new_password,
        });
        if (pwError) {
          return jsonResponse({ ok: false, error: `Password update failed: ${pwError.message}` });
        }

        await adminClient.from("password_history").insert({ user_id, password_hash: pwHash });
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

      return jsonResponse({ ok: true, message: "User updated successfully" });
    }

    // ─── CREATE USER (default action) ───
    const { email, password, full_name, role, department, plant, employee_id } = body;

    if (!email || !password || !full_name || !role) {
      return jsonResponse({ ok: false, error: "Missing required fields: email, password, full_name, role" });
    }

    const policyCheck = validatePasswordPolicy(password);
    if (!policyCheck.valid) {
      return jsonResponse({ ok: false, error: policyCheck.error });
    }

    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name, employee_id: employee_id || email.split('@')[0] },
    });

    if (createError) {
      return jsonResponse({ ok: false, error: createError.message });
    }

    const userId = newUser.user.id;

    await adminClient.from("profiles").update({
      department: department || null,
      plant: plant || null,
      employee_id: employee_id || email.split('@')[0],
    }).eq("user_id", userId);

    const { error: roleError } = await adminClient.from("user_roles").insert({
      user_id: userId,
      role,
    });

    if (roleError) {
      console.error("Role assignment error:", roleError);
    }

    const pwHash = await hashPassword(password);
    await adminClient.from("password_history").insert({ user_id: userId, password_hash: pwHash });
    await adminClient.from("user_security").insert({ user_id: userId, last_password_change: new Date().toISOString() });

    return jsonResponse({ ok: true, user_id: userId, message: `User ${email} created successfully` });
  } catch (error) {
    console.error("Error:", error);
    return jsonResponse({ ok: false, error: (error as Error).message });
  }
});
