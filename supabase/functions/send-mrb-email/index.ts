import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    // Fetch email template
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

    // Find recipients: users with the pending_with role + same plant
    const recipients: string[] = [];
    if (mrb.pending_with) {
      const { data: roleUsers } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', mrb.pending_with);

      if (roleUsers) {
        const userIds = roleUsers.map(r => r.user_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('email, plant')
          .in('user_id', userIds);

        if (profiles) {
          profiles
            .filter(p => p.plant === mrb.plant || !p.plant)
            .forEach(p => recipients.push(p.email));
        }
      }
    }

    // Replace template placeholders
    const replacePlaceholders = (text: string) => {
      return text
        .replace(/\{\{mrb_number\}\}/g, mrb.mrb_number)
        .replace(/\{\{material_description\}\}/g, mrb.material_description)
        .replace(/\{\{plant\}\}/g, mrb.plant)
        .replace(/\{\{pending_with\}\}/g, mrb.pending_with || '')
        .replace(/\{\{final_decision\}\}/g, mrb.final_decision || '')
        .replace(/\{\{pending_days\}\}/g, String(mrb.pending_days || 0));
    };

    const subject = replacePlaceholders(template.subject_template);
    const body = replacePlaceholders(template.body_template);

    // Log the email (actual sending would require an email service like Resend)
    const { error: logError } = await supabase
      .from('email_logs')
      .insert({
        mrb_id: mrb.id,
        mrb_number: mrb.mrb_number,
        subject,
        body,
        recipients: recipients.length > 0 ? recipients : ['system@hbl.com'],
        template: event_type,
        sent_by: triggered_by || mrb.created_by,
        status: 'logged', // Change to 'sent' when email service is configured
      });

    if (logError) {
      console.error('Error logging email:', logError);
    }

    return new Response(JSON.stringify({ 
      success: true, 
      subject,
      recipients,
      message: 'Email logged successfully. Configure an email service (Resend/SendGrid) to enable actual sending.' 
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
