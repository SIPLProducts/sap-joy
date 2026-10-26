CREATE TABLE public.mrb_alert_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mrb_id uuid NOT NULL,
  role_key text NOT NULL,
  user_id uuid,
  email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_mrb_alert_recipients_mrb ON public.mrb_alert_recipients(mrb_id);
GRANT SELECT, INSERT, DELETE ON public.mrb_alert_recipients TO authenticated;
GRANT ALL ON public.mrb_alert_recipients TO service_role;
ALTER TABLE public.mrb_alert_recipients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read alert recipients" ON public.mrb_alert_recipients FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert alert recipients" ON public.mrb_alert_recipients FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth delete alert recipients" ON public.mrb_alert_recipients FOR DELETE TO authenticated USING (true);