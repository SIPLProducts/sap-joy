

## Plan: Fix SAP 343 Unblock Posting + BUDAT Date Format

### Two Issues to Fix

**Issue 1: BUDAT date format sends YYMMDD instead of YYYYMMDD**
The `formatPostingDateForSAP` function uses `.slice(-2)` on the year, producing `260409` instead of `20260409`.

**Issue 2: SAP unblock (343) fails with "SAP sync down" error**
The edge function's `proxyAwareFetch` for the unblock action uses a 30-second timeout (`config.timeout_ms || 30000`). Analytics show the last `sap-sync` call took 31.7 seconds — just over the limit. The AbortController aborts the SAP request, the edge function catches it as a generic error, and the UI shows "SAP unblock edge function failed" or the abort error message. Additionally, the edge function doesn't have graceful degradation for timeout/abort errors.

### Changes

**1. `src/pages/Worklist.tsx`** — Fix date format
- Line 492-498: Change `String(d.getFullYear()).slice(-2)` to `String(d.getFullYear())` to produce `YYYYMMDD`
- Line 492: Update comment from `YYMMDD` to `YYYYMMDD`
- Line 525: Update comment from `YYMMDD` to `YYYYMMDD`

**2. `supabase/functions/sap-sync/index.ts`** — Fix unblock timeout + error handling
- Line 172: Increase default timeout for unblock action from `30000` to `60000` ms (SAP 343 can be slow)
- Lines 168-233: Wrap the entire unblock try/catch in a graceful error handler that returns structured JSON (not a 500) when the fetch is aborted or times out
- Add specific detection for `AbortError` to return a user-friendly message like "SAP request timed out — the server took too long to respond. Please try again."

**3. `src/pages/Worklist.tsx`** — Better error display for unblock failures
- Lines 541-543: Instead of throwing a generic error when `response.error` exists, extract and display the actual error message from the response data for better debugging

### Technical Details
- The edge function analytics show execution times up to 31.7 seconds, which exceeds the default 30s AbortController timeout
- The Supabase SDK's `functions.invoke` also has its own timeout, but the primary bottleneck is the internal AbortController in the edge function
- The fix increases the timeout to 60s and adds abort-specific error handling

### Result
- Posting date sent to SAP as `20260409` (YYYYMMDD) instead of `260409`
- Unblock requests get 60 seconds to complete instead of timing out at 30s
- If SAP still takes too long, users see a clear "timed out" message instead of "SAP sync down"

