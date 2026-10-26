import nodemailer from "npm:nodemailer@6.9.10";

const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const DEFAULTS: Record<string, { subject: string; body: string }> = {
  mrb_next_action: {
    subject: 'Action required: MRB {{mrb_number}} is pending with you',
    body: 'Dear Team,\n\nMRB {{mrb_number}} is now pending with your department ({{pending_with}}) for action.\n\nMaterial: {{material_number}} - {{material_description}}\nPlant: {{plant}}\nVendor: {{vendor_name}}\nQuantity: {{total_quantity}} {{uom}}\n\nPlease log in to the MRB application and take the required action.\n\nRegards,\nMRB System',
  },
  mrb_reminder: {
    subject: 'Reminder: MRB {{mrb_number}} pending for {{pending_days}} day(s)',
    body: 'Dear Team,\n\nThis is a reminder that MRB {{mrb_number}} has been pending with your department ({{pending_with}}) for {{pending_days}} day(s) without action.\n\nMaterial: {{material_number}} - {{material_description}}\nPlant: {{plant}}\n\nPlease log in to the MRB application and complete your action.\n\nRegards,\nMRB System',
  },
};

export async function sendPendingEmail(supabase: any, mrb: any, kind: 'mrb_next_action' | 'mrb_reminder', extra: Record<string, string> = {}) {
  const role = mrb.pending_with;
  if (!role) return { skipped: true, reason: 'No pending department' };

  // Template (optional; inactive template disables this email type)
  const { data: tpls } = await supabase.from('email_templates').select('*')
    .eq('template_key', kind).or(`plant.is.null,plant.eq.${mrb.plant}`);
  const plantTpl = (tpls || []).find((t: any) => t.plant === mrb.plant) || (tpls || [])[0];
  if (plantTpl && !plantTpl.is_active) return { skipped: true, reason: 'Template inactive' };
  const subjectT = plantTpl?.subject_template || DEFAULTS[kind].subject;
  const bodyT = plantTpl?.body_template || DEFAULTS[kind].body;

  // Recipients: initiator-chosen for this role, else all role users in plant
  const to: string[] = [];
  const { data: chosen } = await supabase.from('mrb_alert_recipients').select('email')
    .eq('mrb_id', mrb.id).eq('role_key', role);
  if (chosen && chosen.length) {
    chosen.forEach((c: any) => isValidEmail(c.email) && !to.includes(c.email) && to.push(c.email));
  } else {
    const { data: ru } = await supabase.from('user_roles').select('user_id').eq('role', role);
    const ids = (ru || []).map((r: any) => r.user_id);
    if (ids.length) {
      const { data: profs } = await supabase.from('profiles').select('email, plant').in('user_id', ids);
      (profs || []).filter((p: any) => p.plant === mrb.plant || !p.plant)
        .forEach((p: any) => isValidEmail(p.email) && !to.includes(p.email) && to.push(p.email));
    }
  }
  (plantTpl?.cc_emails || []).length; // cc handled below
  const cc = ((plantTpl?.cc_emails || []) as string[]).flatMap(e => e.split(',')).map(e => e.trim())
    .filter(e => isValidEmail(e) && !to.includes(e));
  if (!to.length) return { skipped: true, reason: 'No recipients' };

  const vars: Record<string, string> = { ...extra };
  for (const [k, v] of Object.entries(mrb)) if (!(k in vars)) vars[k] = v != null ? String(v) : 'N/A';
  const rep = (t: string) => t.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? '');
  const subject = rep(subjectT);
  const body = rep(bodyT);

  const { data: smtp } = await supabase.from('smtp_config').select('*').eq('is_active', true)
    .or(`plant.is.null,plant.eq.${mrb.plant}`).order('plant', { ascending: false, nullsFirst: false })
    .limit(1).maybeSingle();

  let status = 'logged';
  if (smtp) {
    try {
      const tr = nodemailer.createTransport({
        host: smtp.smtp_host, port: smtp.smtp_port, secure: smtp.smtp_port === 465,
        auth: { user: smtp.smtp_username, pass: smtp.smtp_password }, tls: { rejectUnauthorized: false },
      });
      const html = `<div style="font-family:Segoe UI,Arial,sans-serif;font-size:14px;color:#2c3e50">${body.split('\n').map(l => esc(l)).join('<br/>')}</div>`;
      await tr.sendMail({
        from: smtp.sender_name ? `"${smtp.sender_name}" <${smtp.sender_email}>` : smtp.sender_email,
        to, cc: cc.length ? cc : undefined, subject, html,
      });
      status = 'sent';
    } catch (e) { console.error('SMTP failed', e); status = 'failed'; }
  }

  await supabase.from('email_logs').insert({
    mrb_id: mrb.id, mrb_number: mrb.mrb_number, subject, body, recipients: to,
    cc: cc.length ? cc : null, template: kind, sent_by: null, status,
  });
  return { status, to, cc };
}
