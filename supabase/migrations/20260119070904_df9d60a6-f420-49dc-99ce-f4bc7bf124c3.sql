-- Drop existing update policy and create a more comprehensive one
DROP POLICY IF EXISTS "Role-based MRB update access" ON public.mrb_records;

-- Create updated policy that allows:
-- 1. Creator can update drafts
-- 2. Quality role can update drafts (to submit for review) and quality_review status
-- 3. Other roles based on their respective statuses
-- 4. Admin can update anything
CREATE POLICY "Role-based MRB update access" ON public.mrb_records
FOR UPDATE USING (
  -- Creator can update their own drafts
  (auth.uid() = created_by AND status = 'draft')
  -- Quality users can update draft (submit) and quality_review
  OR (has_role(auth.uid(), 'quality'::app_role) AND status IN ('draft', 'quality_review'))
  -- Quality head gets broader access
  OR (has_role(auth.uid(), 'quality_head'::app_role) AND status IN ('draft', 'quality_review', 'final_approval'))
  -- Purchase team access
  OR (has_role(auth.uid(), 'purchase'::app_role) AND status = 'purchase_review')
  OR (has_role(auth.uid(), 'purchase_head'::app_role) AND status IN ('purchase_review', 'final_approval'))
  -- Engineering team access
  OR (has_role(auth.uid(), 'engineering'::app_role) AND status = 'engineering_review')
  OR (has_role(auth.uid(), 'engineering_head'::app_role) AND status IN ('engineering_review', 'final_approval'))
  -- Shop floor can update their own drafts
  OR (has_role(auth.uid(), 'shop_floor'::app_role) AND status = 'draft' AND auth.uid() = created_by)
  -- Executive and admin have broad access
  OR (has_role(auth.uid(), 'executive'::app_role) AND status = 'final_approval')
  OR has_role(auth.uid(), 'admin'::app_role)
);