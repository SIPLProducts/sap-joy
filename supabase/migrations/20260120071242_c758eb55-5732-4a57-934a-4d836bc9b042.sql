-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Role-based MRB update access" ON mrb_records;

-- Create a new policy that allows roles to update MRB records when it's pending with them
-- This includes the ability to transition to the next status
CREATE POLICY "Role-based MRB update access" ON mrb_records
FOR UPDATE
USING (
  -- Creator can update draft records
  ((auth.uid() = created_by) AND (status = 'draft'::mrb_status))
  -- Quality can update when pending_with = quality OR status = quality_review
  OR (has_role(auth.uid(), 'quality'::app_role) AND (pending_with = 'quality'::app_role OR status IN ('draft'::mrb_status, 'quality_review'::mrb_status)))
  -- Quality Head has extended access
  OR (has_role(auth.uid(), 'quality_head'::app_role) AND (pending_with = 'quality_head'::app_role OR status IN ('draft'::mrb_status, 'quality_review'::mrb_status, 'final_approval'::mrb_status)))
  -- Purchase can update when pending_with = purchase OR status = purchase_review
  OR (has_role(auth.uid(), 'purchase'::app_role) AND (pending_with = 'purchase'::app_role OR status = 'purchase_review'::mrb_status))
  -- Purchase Head has extended access
  OR (has_role(auth.uid(), 'purchase_head'::app_role) AND (pending_with = 'purchase_head'::app_role OR status IN ('purchase_review'::mrb_status, 'final_approval'::mrb_status)))
  -- Engineering can update when pending_with = engineering OR status = engineering_review
  OR (has_role(auth.uid(), 'engineering'::app_role) AND (pending_with = 'engineering'::app_role OR status = 'engineering_review'::mrb_status))
  -- Engineering Head has extended access
  OR (has_role(auth.uid(), 'engineering_head'::app_role) AND (pending_with = 'engineering_head'::app_role OR status IN ('engineering_review'::mrb_status, 'final_approval'::mrb_status)))
  -- Shop floor can update their own drafts
  OR (has_role(auth.uid(), 'shop_floor'::app_role) AND (status = 'draft'::mrb_status) AND (auth.uid() = created_by))
  -- Executive can update final approval
  OR (has_role(auth.uid(), 'executive'::app_role) AND (pending_with = 'executive'::app_role OR status = 'final_approval'::mrb_status))
  -- MRB Committee can update when pending_with = mrb_committee
  OR (has_role(auth.uid(), 'mrb_committee'::app_role) AND (pending_with = 'mrb_committee'::app_role))
  -- Admin has full access
  OR has_role(auth.uid(), 'admin'::app_role)
);