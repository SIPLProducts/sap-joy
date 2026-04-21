-- Relax NOT NULL on audit columns so ON DELETE SET NULL is valid
ALTER TABLE public.mrb_records          ALTER COLUMN created_by   DROP NOT NULL;
ALTER TABLE public.mrb_attachments      ALTER COLUMN uploaded_by  DROP NOT NULL;
ALTER TABLE public.mrb_approval_history ALTER COLUMN performed_by DROP NOT NULL;
ALTER TABLE public.email_logs           ALTER COLUMN sent_by      DROP NOT NULL;

-- mrb_records: 6 FKs to auth.users
ALTER TABLE public.mrb_records DROP CONSTRAINT IF EXISTS mrb_records_created_by_fkey;
ALTER TABLE public.mrb_records ADD  CONSTRAINT mrb_records_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.mrb_records DROP CONSTRAINT IF EXISTS mrb_records_quality_approved_by_fkey;
ALTER TABLE public.mrb_records ADD  CONSTRAINT mrb_records_quality_approved_by_fkey
  FOREIGN KEY (quality_approved_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.mrb_records DROP CONSTRAINT IF EXISTS mrb_records_purchase_approved_by_fkey;
ALTER TABLE public.mrb_records ADD  CONSTRAINT mrb_records_purchase_approved_by_fkey
  FOREIGN KEY (purchase_approved_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.mrb_records DROP CONSTRAINT IF EXISTS mrb_records_engineering_approved_by_fkey;
ALTER TABLE public.mrb_records ADD  CONSTRAINT mrb_records_engineering_approved_by_fkey
  FOREIGN KEY (engineering_approved_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.mrb_records DROP CONSTRAINT IF EXISTS mrb_records_final_approved_by_fkey;
ALTER TABLE public.mrb_records ADD  CONSTRAINT mrb_records_final_approved_by_fkey
  FOREIGN KEY (final_approved_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.mrb_records DROP CONSTRAINT IF EXISTS mrb_records_closed_by_fkey;
ALTER TABLE public.mrb_records ADD  CONSTRAINT mrb_records_closed_by_fkey
  FOREIGN KEY (closed_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- mrb_attachments
ALTER TABLE public.mrb_attachments DROP CONSTRAINT IF EXISTS mrb_attachments_uploaded_by_fkey;
ALTER TABLE public.mrb_attachments ADD  CONSTRAINT mrb_attachments_uploaded_by_fkey
  FOREIGN KEY (uploaded_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- mrb_approval_history
ALTER TABLE public.mrb_approval_history DROP CONSTRAINT IF EXISTS mrb_approval_history_performed_by_fkey;
ALTER TABLE public.mrb_approval_history ADD  CONSTRAINT mrb_approval_history_performed_by_fkey
  FOREIGN KEY (performed_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- email_logs
ALTER TABLE public.email_logs DROP CONSTRAINT IF EXISTS email_logs_sent_by_fkey;
ALTER TABLE public.email_logs ADD  CONSTRAINT email_logs_sent_by_fkey
  FOREIGN KEY (sent_by) REFERENCES auth.users(id) ON DELETE SET NULL;