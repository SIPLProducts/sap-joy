-- Create shop_floor_stock table to store available stock data (from uploads or SAP API)
CREATE TABLE public.shop_floor_stock (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plant VARCHAR(50) NOT NULL,
  material_code VARCHAR(50) NOT NULL,
  material_description TEXT,
  batch VARCHAR(50),
  storage_location VARCHAR(50),
  available_quantity NUMERIC NOT NULL DEFAULT 0,
  uom VARCHAR(20) DEFAULT 'EA',
  production_order VARCHAR(50),
  reservation_number VARCHAR(50),
  sap_sync_id VARCHAR(100),
  status VARCHAR(20) DEFAULT 'available' CHECK (status IN ('available', 'blocked', 'reserved')),
  source VARCHAR(20) DEFAULT 'manual' CHECK (source IN ('manual', 'upload', 'sap_api')),
  upload_batch_id VARCHAR(100),
  uploaded_by VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create sap_api_config table to store SAP API configuration
CREATE TABLE public.sap_api_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  config_name VARCHAR(100) NOT NULL,
  api_endpoint TEXT NOT NULL,
  auth_type VARCHAR(50) DEFAULT 'basic' CHECK (auth_type IN ('basic', 'oauth', 'api_key')),
  username VARCHAR(255),
  encrypted_password TEXT,
  api_key TEXT,
  client_id VARCHAR(255),
  client_secret TEXT,
  token_url TEXT,
  is_active BOOLEAN DEFAULT true,
  last_sync_at TIMESTAMP WITH TIME ZONE,
  sync_frequency VARCHAR(50) DEFAULT 'manual' CHECK (sync_frequency IN ('manual', 'hourly', 'daily', 'weekly')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create sap_stock_sync_history table
CREATE TABLE public.sap_stock_sync_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  config_id UUID REFERENCES public.sap_api_config(id),
  sync_type VARCHAR(50) DEFAULT 'full',
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'success', 'failed')),
  records_fetched INTEGER DEFAULT 0,
  records_inserted INTEGER DEFAULT 0,
  records_updated INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  synced_by VARCHAR(255)
);

-- Enable Row Level Security
ALTER TABLE public.shop_floor_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sap_api_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sap_stock_sync_history ENABLE ROW LEVEL SECURITY;

-- RLS policies for shop_floor_stock - all authenticated users can view
CREATE POLICY "Authenticated users can view shop floor stock" 
ON public.shop_floor_stock 
FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can insert shop floor stock" 
ON public.shop_floor_stock 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Authenticated users can update shop floor stock" 
ON public.shop_floor_stock 
FOR UPDATE 
USING (true);

-- RLS policies for sap_api_config - admin only for sensitive config
CREATE POLICY "All authenticated users can view SAP config" 
ON public.sap_api_config 
FOR SELECT 
USING (true);

CREATE POLICY "All authenticated users can manage SAP config" 
ON public.sap_api_config 
FOR ALL 
USING (true);

-- RLS policies for sap_stock_sync_history
CREATE POLICY "Authenticated users can view sync history" 
ON public.sap_stock_sync_history 
FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can insert sync history" 
ON public.sap_stock_sync_history 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Authenticated users can update sync history" 
ON public.sap_stock_sync_history 
FOR UPDATE 
USING (true);

-- Add indexes for common queries
CREATE INDEX idx_shop_floor_stock_plant ON public.shop_floor_stock(plant);
CREATE INDEX idx_shop_floor_stock_material ON public.shop_floor_stock(material_code);
CREATE INDEX idx_shop_floor_stock_batch ON public.shop_floor_stock(batch);
CREATE INDEX idx_shop_floor_stock_status ON public.shop_floor_stock(status);
CREATE INDEX idx_shop_floor_stock_source ON public.shop_floor_stock(source);

-- Trigger for updating updated_at
CREATE TRIGGER update_shop_floor_stock_updated_at
BEFORE UPDATE ON public.shop_floor_stock
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sap_api_config_updated_at
BEFORE UPDATE ON public.sap_api_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();