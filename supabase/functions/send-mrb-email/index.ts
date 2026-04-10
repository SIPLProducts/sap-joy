import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EmailRequest {
  mrb_id: string;
  event_type: 'mrb_created' | 'mrb_forwarded' | 'mrb_approved' | 'mrb_rejected' | 'sla_warning';
  triggered_by?: string;
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

    // Fetch email template for plant + event type
    const { data: template } = await supabase
      .from('email_templates')
      .select('*')
      .eq('template_key', event_type)
      .eq('is_active', true)
      .or(`plant.is.null,plant.eq.${mrb.plant}`)
      .order('plant', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();

    if (!template) {
      return new Response(JSON.stringify({ error: 'No active template found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch SMTP config for plant (fall back to global)
    const { data: smtpConfig } = await supabase
      .from('smtp_config')
      .select('*')
      .eq('is_active', true)
      .or(`plant.is.null,plant.eq.${mrb.plant}`)
      .order('plant', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();

    // Build variable replacement map from MRB + inspection lot
    const varMap: Record<string, string> = {};
    for (const [key, value] of Object.entries(mrb)) {
      varMap[key] = value != null ? String(value) : 'N/A';
    }
    for (const [key, value] of Object.entries(inspectionLot)) {
      if (!varMap[key]) {
        varMap[key] = value != null ? String(value) : 'N/A';
      }
    }

    // Replace all {{variable}} placeholders
    const replacePlaceholders = (text: string) => {
      return text.replace(/\{\{(\w+)\}\}/g, (_, key) => varMap[key] ?? '');
    };

    const subject = replacePlaceholders(template.subject_template);
    const body = replacePlaceholders(template.body_template);

    // Resolve recipients from workflow_routing roles + template roles
    const toEmails = new Set<string>(template.to_emails || []);
    const ccEmails = new Set<string>(template.cc_emails || []);

    // Get all roles to resolve: from workflow_routing + template to_roles/cc_roles
    const workflowRoles: string[] = Array.isArray(mrb.workflow_routing)
      ? mrb.workflow_routing.map((r: any) => typeof r === 'string' ? r : r?.role_key || r?.department).filter(Boolean)
      : [];

    const toRoles = new Set<string>([...workflowRoles, ...(template.to_roles || [])]);
    const ccRoles = new Set<string>(template.cc_roles || []);

    // Resolve role emails: find users with those roles + matching plant
    const resolveRoleEmails = async (roles: Set<string>): Promise<string[]> => {
      if (roles.size === 0) return [];
      const { data: roleUsers } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('role', Array.from(roles));

      if (!roleUsers || roleUsers.length === 0) return [];

      const userIds = roleUsers.map(r => r.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('email, plant, user_id')
        .in('user_id', userIds);

      if (!profiles) return [];
      return profiles
        .filter(p => p.plant === mrb.plant || !p.plant)
        .map(p => p.email);
    };

    const toRoleEmails = await resolveRoleEmails(toRoles);
    const ccRoleEmails = await resolveRoleEmails(ccRoles);

    toRoleEmails.forEach(e => toEmails.add(e));
    ccRoleEmails.forEach(e => ccEmails.add(e));

    // Remove duplicates: CC should not include anyone already in To
    toEmails.forEach(e => ccEmails.delete(e));

    const recipientArray = Array.from(toEmails);
    const ccArray = Array.from(ccEmails);

    let sendStatus = 'logged';
    let errorMessage: string | null = null;

    // Try sending via SMTP if config exists
    if (smtpConfig) {
      try {
        const client = new SMTPClient({
          connection: {
            hostname: smtpConfig.smtp_host,
            port: smtpConfig.smtp_port,
            tls: smtpConfig.use_tls,
            auth: {
              username: smtpConfig.smtp_username,
              password: smtpConfig.smtp_password,
            },
          },
        });

        await client.send({
          from: smtpConfig.sender_name
            ? `${smtpConfig.sender_name} <${smtpConfig.sender_email}>`
            : smtpConfig.sender_email,
          to: recipientArray.length > 0 ? recipientArray.join(', ') : smtpConfig.sender_email,
          cc: ccArray.length > 0 ? ccArray.join(', ') : undefined,
          subject,
          content: body,
        });

        await client.close();
        sendStatus = 'sent';
      } catch (smtpError) {
        console.error('SMTP send failed:', smtpError);
        sendStatus = 'failed';
        errorMessage = (smtpError as Error).message;
      }
    }

    // Log the email
    const { error: logError } = await supabase
      .from('email_logs')
      .insert({
        mrb_id: mrb.id,
        mrb_number: mrb.mrb_number,
        subject,
        body,
        recipients: recipientArray.length > 0 ? recipientArray : ['system@hbl.com'],
        cc: ccArray.length > 0 ? ccArray : null,
        template: event_type,
        sent_by: triggered_by || mrb.created_by,
        status: sendStatus,
      });

    if (logError) {
      console.error('Error logging email:', logError);
    }

    return new Response(JSON.stringify({
      success: true,
      subject,
      recipients: recipientArray,
      cc: ccArray,
      status: sendStatus,
      error: errorMessage,
      message: smtpConfig
        ? (sendStatus === 'sent' ? 'Email sent successfully via SMTP.' : `SMTP send failed: ${errorMessage}`)
        : 'Email logged. Configure SMTP settings to enable actual sending.',
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
