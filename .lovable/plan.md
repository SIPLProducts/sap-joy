

## Plan: Dual-Mode Architecture (Lovable Cloud Dev + Self-Hosted Production)

### Current State
- `invokeSapSync()` in `sapSyncClient.ts` **always** calls `invokeDirect()` (browser → middleware), ignoring the `isLovableCloud()` check entirely
- Edge Function `sap-sync/index.ts` exists and works but is never called from the client
- Connection modes (`vpn_tunnel`, `proxy`, `direct`) are stored per API config but the routing logic doesn't use them properly
- The `isLovableCloud()` function exists but is unused

### Problem
- **Dev mode (Lovable Cloud + ngrok):** Browser makes HTTPS→HTTP calls which get blocked by mixed-content. Should route through Edge Function instead.
- **Production (self-hosted):** Browser→middleware direct calls work fine since both are HTTP on the same network.

### Solution

**One code change in `src/lib/sapSyncClient.ts`** — restore the dual-mode routing in `invokeSapSync()`:

```text
┌─────────────────────────────────────────────────┐
│              invokeSapSync()                    │
│                                                 │
│  isLovableCloud()?                              │
│    YES ──► Edge Function (sap-sync)             │
│            Edge Fn reads config from DB         │
│            Edge Fn calls ngrok/proxy URL        │
│            ngrok → Node.js middleware → SAP     │
│                                                 │
│    NO  ──► invokeDirect()                       │
│            Browser reads config from DB         │
│            Browser calls middleware directly    │
│            http://10.10.4.178:3002 → SAP        │
└─────────────────────────────────────────────────┘
```

### File Changes

**1. `src/lib/sapSyncClient.ts`** — Update `invokeSapSync()` (lines 1164-1171):
- If `isLovableCloud()` is true, call `supabase.functions.invoke('sap-sync', { body })` (the Edge Function)
- If false, call `invokeDirect(body)` as it does now
- This is ~10 lines changed

**2. `supabase/functions/sap-sync/index.ts`** — Minor fix:
- Change `.single()` to `.maybeSingle()` on config lookup (line 44) to match the resilience already in `sapSyncClient.ts`
- Ensure `unblock`, `update_transaction_qty`, and `fetch_live` actions are handled (verify they exist)

### No Other Changes Needed
- SAP API Settings UI already lets users set `connection_mode` and `proxy_tunnel_url` per config
- Edge Function already reads `proxy_tunnel_url` and routes through it
- Deploy scripts already handle both environments
- The `.env` determines which mode: `VITE_SUPABASE_URL=https://xxx.supabase.co` → Cloud, `VITE_SUPABASE_URL=http://10.10.4.178:8000` → Self-hosted

### How It Works for Each Scenario

**Developer (Lovable Cloud + ngrok):**
1. Set connection mode to "VPN Tunnel" in SAP API Settings
2. Set proxy URL to ngrok URL (e.g., `https://abc.ngrok-free.app`)
3. App detects `supabase.co` → routes through Edge Function → Edge Function calls ngrok → Node.js → VPN → SAP

**Production (Self-Hosted):**
1. Set connection mode to "proxy" or "vpn_tunnel"
2. Set proxy URL to `http://10.10.4.178:3002`
3. App detects non-supabase.co URL → calls middleware directly from browser → Node.js → SAP

