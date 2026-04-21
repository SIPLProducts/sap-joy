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
  OR (
    status = 'approved'::mrb_status
    AND COALESCE(sap_stock_update_status, 'pending') <> 'synced'
    AND (
      public.get_user_role(auth.uid()) = 'quality'
      OR auth.jwt() ->> 'email' = 'masteradmin@sharviinfotech.com'
    )
  )
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::text)
  OR (
    auth.uid() = created_by
    AND status = 'draft'::mrb_status
  )
  OR pending_with IS NULL
  OR pending_with = public.get_user_role(auth.uid())
  OR workflow_routing ? pending_with
  OR (
    status = 'approved'::mrb_status
    AND COALESCE(sap_stock_update_status, 'pending') IN ('pending', 'synced', 'success')
    AND (
      public.get_user_role(auth.uid()) = 'quality'
      OR auth.jwt() ->> 'email' = 'masteradmin@sharviinfotech.com'
    )
  )
);