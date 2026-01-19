-- Add 'mrb_committee' to the app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'mrb_committee';

-- Add MRB Committee fields to mrb_records table
ALTER TABLE public.mrb_records 
ADD COLUMN IF NOT EXISTS mrb_committee_decision text,
ADD COLUMN IF NOT EXISTS mrb_committee_remarks text,
ADD COLUMN IF NOT EXISTS mrb_committee_approved_by text,
ADD COLUMN IF NOT EXISTS mrb_committee_approved_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS mrb_committee_required boolean DEFAULT false;