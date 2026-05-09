-- Plant isolation: helper function + tightened RLS so users only see rows for plants they're assigned to.

-- Helper: returns true if user is assigned to plant, OR user is admin / executive (full bypass).
CREATE OR REPLACE FUNCTION public.user_has_plant(_user_id uuid, _plant text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    _plant IS NULL
    OR public.has_role(_user_id, 'admin')
    OR public.has_role(_user_id, 'executive')
    OR EXISTS (
      SELECT 1 FROM public.user_plants
      WHERE user_id = _user_id AND plant_code = _plant
    );
$$;

-- ── mrb_records ──
DROP POLICY IF EXISTS "Authenticated users can view MRB records" ON public.mrb_records;
CREATE POLICY "Users view MRB records for assigned plants"
  ON public.mrb_records FOR SELECT TO authenticated
  USING (public.user_has_plant(auth.uid(), plant));

-- ── inward_inspection_lots ──
DROP POLICY IF EXISTS "Authenticated users can view inspection lots" ON public.inward_inspection_lots;
CREATE POLICY "Users view inspection lots for assigned plants"
  ON public.inward_inspection_lots FOR SELECT TO authenticated
  USING (public.user_has_plant(auth.uid(), plant));

DROP POLICY IF EXISTS "Authenticated users can insert inspection lots" ON public.inward_inspection_lots;
CREATE POLICY "Users insert inspection lots for assigned plants"
  ON public.inward_inspection_lots FOR INSERT TO authenticated
  WITH CHECK (public.user_has_plant(auth.uid(), plant));

DROP POLICY IF EXISTS "Authenticated users can update inspection lots" ON public.inward_inspection_lots;
CREATE POLICY "Users update inspection lots for assigned plants"
  ON public.inward_inspection_lots FOR UPDATE TO authenticated
  USING (public.user_has_plant(auth.uid(), plant))
  WITH CHECK (public.user_has_plant(auth.uid(), plant));

-- ── shop_floor_stock ──
DROP POLICY IF EXISTS "Authenticated users can view shop floor stock" ON public.shop_floor_stock;
CREATE POLICY "Users view shop floor stock for assigned plants"
  ON public.shop_floor_stock FOR SELECT TO authenticated
  USING (public.user_has_plant(auth.uid(), plant::text));

DROP POLICY IF EXISTS "Authenticated users can insert shop floor stock" ON public.shop_floor_stock;
CREATE POLICY "Users insert shop floor stock for assigned plants"
  ON public.shop_floor_stock FOR INSERT TO authenticated
  WITH CHECK (public.user_has_plant(auth.uid(), plant::text));

DROP POLICY IF EXISTS "Authenticated users can update shop floor stock" ON public.shop_floor_stock;
CREATE POLICY "Users update shop floor stock for assigned plants"
  ON public.shop_floor_stock FOR UPDATE TO authenticated
  USING (public.user_has_plant(auth.uid(), plant::text))
  WITH CHECK (public.user_has_plant(auth.uid(), plant::text));

-- ── zmrb_inward_report ──
DROP POLICY IF EXISTS "Authenticated users can view zmrb inward report" ON public.zmrb_inward_report;
CREATE POLICY "Users view zmrb inward report for assigned plants"
  ON public.zmrb_inward_report FOR SELECT TO authenticated
  USING (public.user_has_plant(auth.uid(), plant));

DROP POLICY IF EXISTS "Authenticated users can insert zmrb inward report" ON public.zmrb_inward_report;
CREATE POLICY "Users insert zmrb inward report for assigned plants"
  ON public.zmrb_inward_report FOR INSERT TO authenticated
  WITH CHECK (public.user_has_plant(auth.uid(), plant));

DROP POLICY IF EXISTS "Authenticated users can update zmrb inward report" ON public.zmrb_inward_report;
CREATE POLICY "Users update zmrb inward report for assigned plants"
  ON public.zmrb_inward_report FOR UPDATE TO authenticated
  USING (public.user_has_plant(auth.uid(), plant))
  WITH CHECK (public.user_has_plant(auth.uid(), plant));

-- ── mrb_attachments (joined via parent mrb_records.plant) ──
DROP POLICY IF EXISTS "Authenticated users can view MRB attachments" ON public.mrb_attachments;
CREATE POLICY "Users view attachments for assigned-plant MRBs"
  ON public.mrb_attachments FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.mrb_records m
      WHERE m.id = mrb_attachments.mrb_id
        AND public.user_has_plant(auth.uid(), m.plant)
    )
  );

-- ── mrb_approval_history (joined via parent mrb_records.plant) ──
DROP POLICY IF EXISTS "Authenticated users can view approval history" ON public.mrb_approval_history;
CREATE POLICY "Users view approval history for assigned-plant MRBs"
  ON public.mrb_approval_history FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.mrb_records m
      WHERE m.id = mrb_approval_history.mrb_id
        AND public.user_has_plant(auth.uid(), m.plant)
    )
  );