
CREATE TABLE public.quality_info (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  material_code text NOT NULL,
  vendor_code text,
  plant text NOT NULL,
  submission_date timestamptz NOT NULL DEFAULT now(),
  inspection_lot text,
  submitted_by uuid REFERENCES auth.users(id),
  submitted_by_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.quality_info TO authenticated;
GRANT ALL ON public.quality_info TO service_role;

ALTER TABLE public.quality_info ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view quality_info"
  ON public.quality_info FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated can insert quality_info"
  ON public.quality_info FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = submitted_by);

CREATE POLICY "Submitter or admin can update quality_info"
  ON public.quality_info FOR UPDATE
  TO authenticated USING (
    auth.uid() = submitted_by
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'superadmin')
  );

CREATE POLICY "Admin can delete quality_info"
  ON public.quality_info FOR DELETE
  TO authenticated USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'superadmin')
  );

CREATE TRIGGER update_quality_info_updated_at
  BEFORE UPDATE ON public.quality_info
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_quality_info_plant ON public.quality_info(plant);
CREATE INDEX idx_quality_info_inspection_lot ON public.quality_info(inspection_lot);
