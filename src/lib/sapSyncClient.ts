import { supabase } from '@/integrations/supabase/client';

const SELF_HOSTED_URL_KEY = 'sap_self_hosted_supabase_url';

/**
 * Get/set the self-hosted Supabase URL for SAP edge function calls.
 * When set, SAP sync calls route to self-hosted edge functions instead of Lovable Cloud.
 * This is required when the SAP middleware runs on a private network.
 */
export function getSelfHostedUrl(): string | null {
  return localStorage.getItem(SELF_HOSTED_URL_KEY);
}

export function setSelfHostedUrl(url: string | null) {
  if (url) {
    localStorage.setItem(SELF_HOSTED_URL_KEY, url.replace(/\/$/, ''));
  } else {
    localStorage.removeItem(SELF_HOSTED_URL_KEY);
  }
}

/**
 * Invoke the sap-sync edge function, routing to self-hosted Supabase if configured.
 */
export async function invokeSapSync(body: Record<string, any>): Promise<{ data: any; error: any }> {
  const selfHostedUrl = getSelfHostedUrl();

  // Get auth token
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return { data: null, error: { message: 'Not authenticated' } };
  }

  if (selfHostedUrl) {
    // Route to self-hosted edge function
    try {
      const response = await fetch(`${selfHostedUrl}/functions/v1/sap-sync`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        return { data, error: { message: data.error || data.message || `HTTP ${response.status}` } };
      }

      return { data, error: null };
    } catch (err: any) {
      return { data: null, error: { message: err.message || 'Network error calling self-hosted edge function' } };
    }
  }

  // Fallback to Lovable Cloud edge function
  const { data, error } = await supabase.functions.invoke('sap-sync', { body });
  return { data, error };
}
