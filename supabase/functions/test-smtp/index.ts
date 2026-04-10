import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import nodemailer from "npm:nodemailer@6.9.10";

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
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const transporter = nodemailer.createTransport({
      host: config.smtp_host,
      port: config.smtp_port,
      secure: config.smtp_port === 465,
      auth: {
        user: config.smtp_username,
        pass: config.smtp_password,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });

    const plantLabel = config.plant || "Global";

    await transporter.sendMail({
      from: config.sender_name
        ? `"${config.sender_name}" <${config.sender_email}>`
        : config.sender_email,
      to: to_email,
      subject: `SMTP Test from ${plantLabel} - Configuration Verified`,
      text: `This is a test email from the MRB Email Configuration system.\n\nPlant: ${plantLabel}\nSMTP Host: ${config.smtp_host}\nPort: ${config.smtp_port}\n\nIf you received this email, the SMTP configuration is working correctly.`,
    });

    return new Response(
      JSON.stringify({ success: true, message: "Test email sent successfully" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Test SMTP error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Failed to send test email" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
