DROP POLICY IF EXISTS "Role-based MRB update access" ON public.mrb_records;

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
WITH CHECK (true);