-- Create SAP sync history table
CREATE TABLE public.sap_sync_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  mrb_id UUID NOT NULL REFERENCES public.mrb_records(id) ON DELETE CASCADE,
  mrb_number TEXT NOT NULL,
  sync_type TEXT NOT NULL DEFAULT 'single', -- 'single' or 'batch'
  batch_id UUID NULL, -- Groups batch operations together
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'success', 'failed'
  error_message TEXT NULL,
  synced_by TEXT NOT NULL,
  synced_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  sap_response JSONB NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sap_sync_history ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for SAP sync history
CREATE POLICY "Users can view all SAP sync history"
ON public.sap_sync_history
FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can create SAP sync history"
ON public.sap_sync_history
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Create index for faster lookups
CREATE INDEX idx_sap_sync_history_mrb_id ON public.sap_sync_history(mrb_id);
CREATE INDEX idx_sap_sync_history_batch_id ON public.sap_sync_history(batch_id);
CREATE INDEX idx_sap_sync_history_synced_at ON public.sap_sync_history(synced_at DESC);

-- Enable realtime for the table
ALTER PUBLICATION supabase_realtime ADD TABLE public.sap_sync_history;