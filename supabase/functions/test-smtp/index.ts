import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { smtp_config_id, to_email } = await req.json();

    if (!smtp_config_id || !to_email) {
      return new Response(
        JSON.stringify({ error: "smtp_config_id and to_email are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: config, error: cfgErr } = await supabase
      .from("smtp_config")
      .select("*")
      .eq("id", smtp_config_id)
      .single();

    if (cfgErr || !config) {
      return new Response(
        JSON.stringify({ error: "SMTP configuration not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Port 465 = implicit TLS (tls: true)
    // Port 587/25 = STARTTLS (tls: false, denomailer auto-upgrades via STARTTLS)
    const useImplicitTls = config.smtp_port === 465;

    const client = new SMTPClient({
      connection: {
        hostname: config.smtp_host,
        port: config.smtp_port,
        tls: useImplicitTls,
        auth: {
          username: config.smtp_username,
          password: config.smtp_password,
        },
      },
    });

    const plantLabel = config.plant || "Global";

    await client.send({
      from: config.sender_name
        ? `${config.sender_name} <${config.sender_email}>`
        : config.sender_email,
      to: to_email,
      subject: `SMTP Test from ${plantLabel} - Configuration Verified`,
      content: `This is a test email from the MRB Email Configuration system.\n\nPlant: ${plantLabel}\nSMTP Host: ${config.smtp_host}\nPort: ${config.smtp_port}\nTLS: ${useImplicitTls ? "Implicit TLS" : "STARTTLS"}\n\nIf you received this email, the SMTP configuration is working correctly.`,
    });

    await client.close();

    return new Response(
      JSON.stringify({ success: true, message: "Test email sent successfully" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Test SMTP error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Failed to send test email" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
