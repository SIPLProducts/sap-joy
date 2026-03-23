

# Edge Functions: How They Work & Self-Hosted Strategy

## Current Situation

| Environment | Edge Function Status | Why |
|---|---|---|
| **Lovable Cloud** | ✅ Works | Hosted by Lovable, calls ngrok → middleware → SAP |
| **Self-hosted (10.10.4.178)** | ❌ 503 Error | Edge function Docker container not running/configured |

## The Problem

Your self-hosted Supabase Docker setup doesn't have the Edge Function runtime properly configured. That's why `http://10.10.4.178:8000/functions/v1/sap-sync` returns **503**.

Setting up the Edge Function runtime in Docker is complex — it requires Kong routing rules, a Deno runtime container, mounting function files in the correct volume, and a centralized router. This has been a recurring source of issues.

## Recommended Approach: Environment-Aware Client

Update `sapSyncClient.ts` to detect which environment it's running in and route accordingly:

```text
Lovable Cloud (supabase.co URL):
  Browser → supabase.functions.invoke('sap-sync') → Edge Function → ngrok/middleware → SAP

Self-hosted (private IP URL):
  Browser → direct fetch to middleware URL (from sap_api_config table) → SAP
```

### Changes Required

**1. `src/lib/sapSyncClient.ts`** — Add dual-mode logic:
- Check `VITE_SUPABASE_URL` — if it contains `supabase.co`, use edge function (current behavior)
- If it's a private IP (self-hosted), read `proxy_tunnel_url` and `proxy_secret` from `sap_api_config` table, then call the middleware directly via `fetch()`
- Same response format (`{ data, error }`) so all consuming pages work unchanged

**2. `supabase/functions/sap-sync/index.ts`** — Fix error status codes:
- Change all `status: 400/500` error responses to `status: 200` with `{ success: false }` in body
- This prevents the Supabase JS client from swallowing error details on Lovable Cloud
- Keep `status: 401` only for auth failures

**3. No other file changes needed** — All pages (`SAPApiSettings`, `SAPSyncMonitor`, etc.) already use `invokeSapSync()` and check `data.success`

### Self-Hosted Database Config

Set `proxy_tunnel_url` to `http://10.10.4.178:3002` (the browser will call it directly, so use the network-accessible IP, not `host.docker.internal`)

### Security Note

On the self-hosted server, the `proxy_secret` will be visible in browser network requests. This is acceptable because:
- The app runs on an internal network (10.x.x.x)
- Users are already authenticated
- The middleware is not internet-facing

On Lovable Cloud, the secret stays hidden inside the edge function (server-side only).

