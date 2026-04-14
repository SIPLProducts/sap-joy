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

function generateHtmlEmail(subject: string, body: string, mrbNumber?: string): string {
  const bodyHtml = body
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n\n/g, '</p><p style="margin:0 0 12px 0;line-height:1.6;">')
    .replace(/\n/g, '<br/>');

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f4f6f9;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f9;padding:24px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
  <!-- Header -->
  <tr>
    <td style="background:linear-gradient(135deg,#1a5276,#2471a3);padding:20px 32px;">
      <h1 style="margin:0;color:#ffffff;font-size:18px;font-weight:600;">HBL Power Systems</h1>
      <p style="margin:4px 0 0;color:#d4e6f1;font-size:12px;">Material Review Board — Automated Notification</p>
    </td>
  </tr>
  <!-- Subject bar -->
  <tr>
    <td style="background-color:#eaf2f8;padding:12px 32px;border-bottom:1px solid #d4e6f1;">
      <p style="margin:0;font-size:14px;font-weight:600;color:#1a5276;">${subject.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
      ${mrbNumber ? `<p style="margin:4px 0 0;font-size:12px;color:#5d6d7e;">MRB Reference: <strong>${mrbNumber}</strong></p>` : ''}
    </td>
  </tr>
  <!-- Body -->
  <tr>
    <td style="padding:24px 32px;color:#2c3e50;font-size:14px;">
      <p style="margin:0 0 12px 0;line-height:1.6;">${bodyHtml}</p>
    </td>
  </tr>
  <!-- Footer -->
  <tr>
    <td style="background-color:#f8f9fa;padding:16px 32px;border-top:1px solid #e9ecef;">
      <p style="margin:0;font-size:11px;color:#95a5a6;text-align:center;">
        This is an automated email from the HBL MRB System. Please do not reply directly to this message.<br/>
        &copy; HBL Power Systems Ltd. — Material Review Board
      </p>
    </td>
  </tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

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
            html: generateHtmlEmail(subject, body, mrb.mrb_number),
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
