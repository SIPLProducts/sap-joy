import { supabase } from '@/integrations/supabase/client';

const SELF_HOSTED_URL_KEY = 'sap_self_hosted_supabase_url';

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
 * Invoke the sap-sync edge function.
 * - If selfHostedUrl is set in localStorage, routes there (advanced override).
 * - Otherwise uses Lovable Cloud edge functions (default).
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

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        const text = await response.text();
        return { data: null, error: { message: `Self-hosted backend returned non-JSON (${response.status}): ${text.substring(0, 200)}` } };
      }

      const data = await response.json();
      if (!response.ok) {
        return { data, error: { message: data.error || data.message || `HTTP ${response.status}` } };
      }
      return { data, error: null };
    } catch (err: any) {
      return { data: null, error: { message: err.message || 'Network error calling self-hosted edge function' } };
    }
  }

  // Use Lovable Cloud edge function (default path)
  try {
    const { data, error } = await supabase.functions.invoke('sap-sync', { body });
    
    // supabase.functions.invoke can return error objects or throw
    if (error) {
      // Check if error has a non-JSON message
      const errMsg = typeof error === 'object' 
        ? (error.message || error.msg || JSON.stringify(error))
        : String(error);
      return { data: null, error: { message: errMsg } };
    }
    
    return { data, error: null };
  } catch (err: any) {
    // Handle cases where invoke() throws (e.g., non-JSON response)
    return { data: null, error: { message: err.message || 'Edge function call failed' } };
  }
}
