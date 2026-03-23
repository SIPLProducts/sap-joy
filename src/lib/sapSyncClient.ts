import { supabase } from '@/integrations/supabase/client';

/**
 * Invoke the sap-sync edge function through Lovable Cloud.
 *
 * Important:
 * - In Lovable preview, this must always call the hosted edge function.
 * - The edge function itself reads each API config's `proxy_tunnel_url`
 *   and forwards to your Node.js middleware (ngrok in Lovable, internal HTTP on client server).
 */
export async function invokeSapSync(body: Record<string, any>): Promise<{ data: any; error: any }> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return { data: null, error: { message: 'Not authenticated' } };
  }

  try {
    const { data, error } = await supabase.functions.invoke('sap-sync', { body });

    if (error) {
      const errMsg = typeof error === 'object'
        ? (error.message || error.name || JSON.stringify(error))
        : String(error);

      return { data: null, error: { message: errMsg } };
    }

    return { data, error: null };
  } catch (err: any) {
    return {
      data: null,
      error: { message: err?.message || 'Edge function call failed' },
    };
  }
}
