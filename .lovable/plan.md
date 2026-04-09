

## Plan: Fix SAP Credential Forwarding — `auth` Object Not Sent When Password Has Special Characters

### Root Cause

In `src/lib/sapSyncClient.ts`, the `fetchViaProxy` function (line 132-143) extracts raw credentials for the `auth` object by doing `btoa` → `atob` round-trip on the password. If the SAP password contains special characters (e.g., `#`, `@`, `!`), `atob()` can silently fail or produce corrupted output. When the `catch` block swallows the error, **no `auth` object is sent** to the proxy middleware. The middleware then cannot reconstruct a clean `Authorization: Basic` header, and SAP rejects all 3 attempts.

This only manifests on on-premise (self-hosted) deployments because they use `invokeDirect` → `fetchViaProxy` (client-side). Cloud deployments use the edge function's own `fetchViaProxy` which has the same issue but may have different credential values.

### Fix — Two files

**File 1: `src/lib/sapSyncClient.ts`**

1. Add an optional `rawAuth` parameter to `fetchViaProxy` so callers can pass raw credentials directly (no Base64 round-trip needed)
2. Update `proxyAwareFetch` to extract `username` and `encrypted_password` from the `config` object and pass them as `rawAuth`
3. In `fetchViaProxy`, prefer `rawAuth` over Base64-decoded credentials for the `auth` object
4. Improve the "all attempts exhausted" error message to include the username and password length being used, so the user can verify credentials

**File 2: `supabase/functions/sap-sync/index.ts`**

5. Apply the same fix to the edge function's `fetchViaProxy` — pass raw credentials from `buildAuthHeaders` context instead of re-extracting from Base64

### Technical Detail

Current broken flow:
```text
config.password → btoa(user:pass) → Authorization header → atob() → auth object
                    ↑ encoding issue with special chars causes silent failure
```

Fixed flow:
```text
config.password → auth object (direct, no encoding)
config.password → btoa(user:pass) → Authorization header (kept as fallback)
```

### Result
- Raw SAP credentials are always sent to the proxy in the `auth` object, bypassing Base64 encoding issues
- Proxy can reconstruct a clean `Authorization: Basic` header from raw credentials
- Diagnostic info (username, password length) is shown on failure to help verify config
- Both cloud and on-premise paths use the same credential forwarding logic

