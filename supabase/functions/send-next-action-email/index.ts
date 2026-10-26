import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendPendingEmail } from "../_shared/nextAction.ts";

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (b: unknown) => new Response(JSON.stringify(b), { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  try {
    const { mrb_id } = await req.json();
    if (!mrb_id || typeof mrb_id !== 'string') return json({ ok: false, error: 'mrb_id required' });
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: mrb } = await supabase.from('mrb_records').select('*').eq('id', mrb_id).maybeSingle();
    if (!mrb) return json({ ok: false, error: 'MRB not found' });
    if (['approved', 'rejected', 'closed'].includes(mrb.status)) return json({ ok: true, data: { skipped: true } });
    const r = await sendPendingEmail(supabase, mrb, 'mrb_next_action');
    return json({ ok: true, data: r });
  } catch (e) {
    return json({ ok: false, error: (e as Error).message });
  }
});
