-- Fix the permissive UPDATE policy on mrb_records
DROP POLICY IF EXISTS "Authorized users can update MRB records" ON public.mrb_records;

-- Create more restrictive UPDATE policy based on user roles and MRB status
CREATE POLICY "Role-based MRB update access"
  ON public.mrb_records FOR UPDATE
  TO authenticated
  USING (
    -- Creator can update their drafts
    (auth.uid() = created_by AND status = 'draft')
    OR
    -- Quality roles can update during quality_review
    (public.has_role(auth.uid(), 'quality') AND status = 'quality_review')
    OR
    (public.has_role(auth.uid(), 'quality_head') AND status IN ('quality_review', 'final_approval'))
    OR
    -- Purchase roles can update during purchase_review
    (public.has_role(auth.uid(), 'purchase') AND status = 'purchase_review')
    OR
    (public.has_role(auth.uid(), 'purchase_head') AND status IN ('purchase_review', 'final_approval'))
    OR
    -- Engineering roles can update during engineering_review
    (public.has_role(auth.uid(), 'engineering') AND status = 'engineering_review')
    OR
    (public.has_role(auth.uid(), 'engineering_head') AND status IN ('engineering_review', 'final_approval'))
    OR
    -- Executive can approve final
    (public.has_role(auth.uid(), 'executive') AND status = 'final_approval')
    OR
    -- Admin has full access
    public.has_role(auth.uid(), 'admin')
  );