
-- Create smtp_config table
CREATE TABLE public.smtp_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plant text UNIQUE,
  sender_email text NOT NULL,
  sender_name text NOT NULL DEFAULT '',
  smtp_host text NOT NULL,
  smtp_port integer NOT NULL DEFAULT 587,
  smtp_username text NOT NULL,
  smtp_password text NOT NULL,
  use_tls boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.smtp_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage smtp config"
  ON public.smtp_config FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can view smtp config"
  ON public.smtp_config FOR SELECT
  TO authenticated
  USING (true);

CREATE TRIGGER update_smtp_config_updated_at
  BEFORE UPDATE ON public.smtp_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add columns to email_templates
ALTER TABLE public.email_templates
  ADD COLUMN IF NOT EXISTS to_emails text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS cc_emails text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS to_roles text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS cc_roles text[] DEFAULT '{}';
