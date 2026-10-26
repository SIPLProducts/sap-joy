import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendPendingEmail } from "../_shared/nextAction.ts";

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (b: unknown) => new Response(JSON.stringify(b), { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } });
const DAY = 24 * 3600 * 1000;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: open } = await supabase.from('mrb_records').select('*')
      .not('status', 'in', '(approved,rejected,closed)').not('pending_with', 'is', null);
    const since = new Date(Date.now() - DAY).toISOString();
    const results: any[] = [];
    for (const mrb of open || []) {
      const { data: last } = await supabase.from('mrb_approval_history').select('performed_at')
        .eq('mrb_id', mrb.id).order('performed_at', { ascending: false }).limit(1).maybeSingle();
      const lastAt = new Date(last?.performed_at || mrb.updated_at || mrb.created_at).getTime();
      if (Date.now() - lastAt < DAY) continue;
      const { count } = await supabase.from('email_logs').select('id', { count: 'exact', head: true })
        .eq('mrb_id', mrb.id).eq('template', 'mrb_reminder').gte('sent_at', since);
      if ((count || 0) > 0) continue;
      const days = String(Math.floor((Date.now() - lastAt) / DAY));
      const r = await sendPendingEmail(supabase, mrb, 'mrb_reminder', { pending_days: days });
      results.push({ mrb: mrb.mrb_number, ...r });
    }
    return json({ ok: true, data: { checked: (open || []).length, results } });
  } catch (e) {
    return json({ ok: false, error: (e as Error).message });
  }
});
