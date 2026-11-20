REVOKE EXECUTE ON FUNCTION public.add_dynamic_column(text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.add_dynamic_column(text, text, text) TO service_role;