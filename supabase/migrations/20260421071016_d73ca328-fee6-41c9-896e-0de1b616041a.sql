DROP POLICY IF EXISTS "Workflow assignee can update MRB records" ON public.mrb_records;

CREATE POLICY "Workflow assignee can update MRB records"
ON public.mrb_records
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::text)
  OR (
    auth.uid() = created_by
    AND status = 'draft'::mrb_status
  )
  OR (
    pending_with IS NOT NULL
    AND pending_with = public.get_user_role(auth.uid())
  )
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::text)
  OR auth.uid() = created_by
  OR pending_with IS NULL
  OR pending_with = public.get_user_role(auth.uid())
  OR public.get_user_role(auth.uid()) IS NOT NULL
);