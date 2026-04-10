import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6.9.10";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EmailRequest {
  mrb_id: string;
  event_type: 'mrb_created' | 'mrb_forwarded' | 'mrb_approved' | 'mrb_rejected' | 'sla_warning';
  triggered_by?: string;
}

const normalizeEmails = (arr: string[]): string[] =>
  arr.flatMap(e => e.split(',')).map(e => e.trim()).filter(Boolean);

const isValidEmail = (e: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { mrb_id, event_type, triggered_by } = await req.json() as EmailRequest;

    // Fetch MRB record
    const { data: mrb, error: mrbError } = await supabase
      .from('mrb_records')
      .select('*')
      .eq('id', mrb_id)
      .single();

    if (mrbError || !mrb) {
      return new Response(JSON.stringify({ error: 'MRB not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Extract workflow routing roles
    const workflowRoles: string[] = Array.isArray(mrb.workflow_routing)
      ? mrb.workflow_routing.map((r: any) => typeof r === 'string' ? r : r?.role_key || r?.department).filter(Boolean)
      : [];

    // Fetch inspection lot data if available
    let inspectionLot: Record<string, any> = {};
    if (mrb.inspection_lot) {
      const { data: lot } = await supabase
        .from('inward_inspection_lots')
        .select('*')
        .eq('inspection_lot', mrb.inspection_lot)
        .eq('plant', mrb.plant)
        .limit(1)
        .maybeSingle();
      if (lot) inspectionLot = lot;
    }

    // Fetch active email templates for this event type + plant
    const { data: templates } = await supabase
      .from('email_templates')
      .select('*')
      .eq('template_key', event_type)
      .eq('is_active', true)
      .or(`plant.is.null,plant.eq.${mrb.plant}`);

    if (!templates || templates.length === 0) {
      return new Response(JSON.stringify({ error: 'No active template found', skipped: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build variable replacement map
    const varMap: Record<string, string> = {};
    for (const [key, value] of Object.entries(mrb)) {
      varMap[key] = value != null ? String(value) : 'N/A';
    }
    for (const [key, value] of Object.entries(inspectionLot)) {
      if (!varMap[key]) {
        varMap[key] = value != null ? String(value) : 'N/A';
      }
    }

    const replacePlaceholders = (text: string) =>
      text.replace(/\{\{(\w+)\}\}/g, (_, key) => varMap[key] ?? '');

    // Fetch SMTP config for plant (fall back to global)
    const { data: smtpConfig } = await supabase
      .from('smtp_config')
      .select('*')
      .eq('is_active', true)
      .or(`plant.is.null,plant.eq.${mrb.plant}`)
      .order('plant', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();

    const results: any[] = [];

    for (const template of templates) {
      const templateRoles: string[] = template.to_roles || [];

      // If template has roles configured, check if ANY exist in MRB workflow_routing
      if (templateRoles.length > 0) {
        const hasMatchingRole = templateRoles.some(role => workflowRoles.includes(role));
        if (!hasMatchingRole) {
          results.push({ template_key: template.template_key, skipped: true, reason: 'Role not in workflow routing' });
          continue;
        }
      }

      const subject = replacePlaceholders(template.subject_template);
      const body = replacePlaceholders(template.body_template);

      // Normalize and validate To emails
      const rawTo: string[] = template.to_emails || [];
      const normalizedTo = normalizeEmails(rawTo);
      const toEmails = normalizedTo.filter(e => {
        if (!isValidEmail(e)) { console.warn(`Skipping invalid TO email: ${e}`); return false; }
        return true;
      });

      // Normalize and validate CC emails
      const rawCc: string[] = template.cc_emails || [];
      const normalizedCc = normalizeEmails(rawCc);
      const ccEmails = normalizedCc.filter(e => {
        if (!isValidEmail(e)) { console.warn(`Skipping invalid CC email: ${e}`); return false; }
        return true;
      });

      // Also resolve role-based emails for matching roles
      if (templateRoles.length > 0) {
        const matchingRoles = templateRoles.filter(role => workflowRoles.includes(role));
        if (matchingRoles.length > 0) {
          const { data: roleUsers } = await supabase
            .from('user_roles')
            .select('user_id, role')
            .in('role', matchingRoles);

          if (roleUsers && roleUsers.length > 0) {
            const userIds = roleUsers.map(r => r.user_id);
            const { data: profiles } = await supabase
              .from('profiles')
              .select('email, plant, user_id')
              .in('user_id', userIds);

            if (profiles) {
              profiles
                .filter(p => p.plant === mrb.plant || !p.plant)
                .forEach(p => {
                  if (isValidEmail(p.email) && !toEmails.includes(p.email)) {
                    toEmails.push(p.email);
                  }
                });
            }
          }
        }
      }

      // Remove duplicates: CC should not include anyone already in To
      const finalCc = ccEmails.filter(e => !toEmails.includes(e));

      if (toEmails.length === 0 && finalCc.length === 0) {
        results.push({ template_key: template.template_key, skipped: true, reason: 'No valid recipients after filtering' });
        continue;
      }

      let sendStatus = 'logged';
      let errorMessage: string | null = null;

      // Send via SMTP using nodemailer
      if (smtpConfig) {
        try {
          const transporter = nodemailer.createTransport({
            host: smtpConfig.smtp_host,
            port: smtpConfig.smtp_port,
            secure: smtpConfig.smtp_port === 465,
            auth: {
              user: smtpConfig.smtp_username,
              pass: smtpConfig.smtp_password,
            },
            tls: {
              rejectUnauthorized: false,
            },
          });

          await transporter.sendMail({
            from: smtpConfig.sender_name
              ? `"${smtpConfig.sender_name}" <${smtpConfig.sender_email}>`
              : smtpConfig.sender_email,
            to: toEmails,
            cc: finalCc.length > 0 ? finalCc : undefined,
            subject,
            text: body,
          });

          sendStatus = 'sent';
        } catch (smtpError) {
          console.error('SMTP send failed:', smtpError);
          sendStatus = 'failed';
          errorMessage = (smtpError as Error).message;
        }
      }

      // Log the email
      await supabase.from('email_logs').insert({
        mrb_id: mrb.id,
        mrb_number: mrb.mrb_number,
        subject,
        body,
        recipients: toEmails.length > 0 ? toEmails : ['system@hbl.com'],
        cc: finalCc.length > 0 ? finalCc : null,
        template: event_type,
        sent_by: triggered_by || mrb.created_by,
        status: sendStatus,
      });

      results.push({
        template_key: template.template_key,
        subject,
        recipients: toEmails,
        cc: finalCc,
        status: sendStatus,
        error: errorMessage,
      });
    }

    return new Response(JSON.stringify({
      success: true,
      results,
      message: smtpConfig
        ? 'Email processing complete.'
        : 'Emails logged. Configure SMTP settings to enable actual sending.',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in send-mrb-email:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
