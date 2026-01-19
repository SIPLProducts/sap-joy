-- Enable realtime for mrb_approval_history table
ALTER PUBLICATION supabase_realtime ADD TABLE public.mrb_approval_history;

-- Enable realtime for email_logs table
ALTER PUBLICATION supabase_realtime ADD TABLE public.email_logs;