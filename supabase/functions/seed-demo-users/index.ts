import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DemoUser {
  email: string;
  password: string;
  fullName: string;
  role: string;
}

const demoUsers: DemoUser[] = [
  { email: "quality.demo@hbl.com", password: "demo123", fullName: "Quality Inspector", role: "quality" },
  { email: "qualityhead.demo@hbl.com", password: "demo123", fullName: "Quality Head", role: "quality_head" },
  { email: "purchase.demo@hbl.com", password: "demo123", fullName: "Purchase Team", role: "purchase" },
  { email: "purchasehead.demo@hbl.com", password: "demo123", fullName: "Purchase Head", role: "purchase_head" },
  { email: "engineering.demo@hbl.com", password: "demo123", fullName: "Engineering Team", role: "engineering" },
  { email: "enghead.demo@hbl.com", password: "demo123", fullName: "Engineering Head", role: "engineering_head" },
  { email: "shopfloor.demo@hbl.com", password: "demo123", fullName: "Shop Floor User", role: "shop_floor" },
  { email: "executive.demo@hbl.com", password: "demo123", fullName: "Executive Manager", role: "executive" },
];

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create Supabase admin client
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const results: { email: string; status: string; error?: string }[] = [];

    for (const demoUser of demoUsers) {
      try {
        // Check if user already exists
        const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
        const userExists = existingUsers?.users?.some(u => u.email === demoUser.email);

        if (userExists) {
          results.push({ email: demoUser.email, status: "already_exists" });
          continue;
        }

        // Create user
        const { data: userData, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email: demoUser.email,
          password: demoUser.password,
          email_confirm: true,
          user_metadata: {
            full_name: demoUser.fullName,
          },
        });

        if (createError) {
          results.push({ email: demoUser.email, status: "error", error: createError.message });
          continue;
        }

        if (userData.user) {
          // Assign role
          const { error: roleError } = await supabaseAdmin
            .from("user_roles")
            .insert({
              user_id: userData.user.id,
              role: demoUser.role,
            });

          if (roleError) {
            results.push({ email: demoUser.email, status: "created_no_role", error: roleError.message });
          } else {
            results.push({ email: demoUser.email, status: "created" });
          }
        }
      } catch (userError) {
        results.push({ email: demoUser.email, status: "error", error: String(userError) });
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Demo users seeding completed",
        results 
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
