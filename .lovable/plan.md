

## Plan: Fix SAP 344 Auth Error on MRB Submit

### Problem
The edge function `sap-sync` returns HTTP 401 when `getUser()` fails, causing `supabase.functions.invoke` to throw a generic "Edge Function returned a non-2xx status code" error. The edge function logs confirm: "Auth error: Auth session missing!"

Per the project's own protocol (documented in memory), the edge function should return HTTP 200 for all application-level errors. The auth check at lines 28-31 breaks this pattern by returning 401.

### Root Cause
Two issues:
1. **Edge function returns 401** (line 30) instead of 200 for auth failures — the Supabase SDK swallows the response body on non-2xx, so the client only sees a generic error
2. **Client doesn't refresh token** before calling — `getSession()` may return a cached expired token

### Fix — Two files

**1. `supabase/functions/sap-sync/index.ts` (lines 15-16 and 28-31)**
- Change both auth error responses from `status: 401` to `status: 200` with clear error JSON
- This matches the existing pattern used for config errors (line 48), sync errors (line 76), etc.

**2. `src/lib/sapSyncClient.ts` (line 1378)**
- Before `getSession()`, call `supabase.auth.refreshSession()` to ensure the token is fresh
- This prevents stale token issues on long-lived form sessions

### Technical Detail
The edge function already returns 200 for every other error type (config not found, SAP failure, etc.). Only the two auth checks (lines 15-16 and 28-31) break this pattern. Changing them to 200 ensures the SDK passes the response body through, giving users a meaningful "Please log in again" message instead of the generic SDK error.

### Result
- Auth failures return a clear error message instead of generic "non-2xx status code"
- Token is refreshed before SAP calls, preventing stale session issues
- MRB submit flow works correctly when the user is authenticated

