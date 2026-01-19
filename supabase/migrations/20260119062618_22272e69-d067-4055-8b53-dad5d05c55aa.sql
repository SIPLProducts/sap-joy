-- Create table for uploaded inward inspection lots
CREATE TABLE public.inward_inspection_lots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  inspection_lot TEXT NOT NULL,
  material_code TEXT NOT NULL,
  material_description TEXT,
  plant TEXT NOT NULL,
  storage_location TEXT,
  batch TEXT,
  blocked_quantity NUMERIC NOT NULL DEFAULT 0,
  transaction_quantity NUMERIC NOT NULL DEFAULT 0,
  uom TEXT DEFAULT 'EA',
  inspection_date DATE,
  posting_date DATE,
  block_reason TEXT,
  vendor_code TEXT,
  vendor_name TEXT,
  po_number TEXT,
  grn_number TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'mrb_created', 'cleared')),
  uploaded_by TEXT,
  upload_batch_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.inward_inspection_lots ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users
CREATE POLICY "Authenticated users can view inspection lots"
ON public.inward_inspection_lots
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert inspection lots"
ON public.inward_inspection_lots
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update inspection lots"
ON public.inward_inspection_lots
FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete inspection lots"
ON public.inward_inspection_lots
FOR DELETE
TO authenticated
USING (true);

-- Create trigger for updated_at
CREATE TRIGGER update_inward_inspection_lots_updated_at
BEFORE UPDATE ON public.inward_inspection_lots
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for inward uploads
INSERT INTO storage.buckets (id, name, public)
VALUES ('inward-uploads', 'inward-uploads', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for authenticated users
CREATE POLICY "Authenticated users can upload inward files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'inward-uploads');

CREATE POLICY "Authenticated users can view inward files"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'inward-uploads');

CREATE POLICY "Authenticated users can delete inward files"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'inward-uploads');