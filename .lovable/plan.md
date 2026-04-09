
Diagnosis
- The 404 is not from ngrok or your Node route. Runtime evidence shows the request reaches `https://...ngrok.../proxy`, and your proxy forwards it to `http://10.10.6.115:8000/sap/api/zmrb01?sap-client=234`.
- The response body is SAP’s HTML `Logon Error Message`, so the failing part is SAP auth/client formatting, not tunnel reachability.
- In cloud preview, `invokeSapSync()` routes through the `sap-sync` backend function. The current UI help text still says the preview browser calls middleware directly, which is misleading.
- The browser client has richer SAP credential fallback logic, but the backend function and scheduler do not. `Test Route` currently uses a single attempt, so auth-like SAP failures returned as 404 are surfaced without retries.

Plan
1. Unify SAP request compatibility logic
   - Create one internal retry strategy for wrapped `POST /proxy` calls.
   - Keep your existing global Node proxy unchanged.
   - Retry on auth-like failures, including SAP HTML login pages returned as 404.

2. Fix the cloud preview path
   - Update `supabase/functions/sap-sync/index.ts` so `test`, `sync`, `fetch_live`, `unblock`, and `update_transaction_qty` all use the same fallback helper.
   - Port the missing compatibility behavior already present on the browser side:
     - trimmed credentials
     - alternate credential header aliases
     - sap-client in header vs query
     - credentials in payload/query when needed
     - friendly detection of `Logon Error Message` / `Anmeldung fehlgeschlagen`

3. Fix the direct/self-hosted path
   - Refactor `src/lib/sapSyncClient.ts` so `directTest()` uses the same retry helper.
   - Adjust the current stop condition so auth-like 404 responses do not stop after the first attempt.

4. Fix scheduled syncs
   - Update `supabase/functions/sap-sync-scheduler/index.ts` to use the same wrapped `/proxy` protocol.
   - It currently builds `proxy_tunnel_url + endpoint_path`, which does not match your existing `POST /proxy` middleware and will keep failing in scheduled/cloud scenarios.

5. Improve diagnostics
   - Replace raw `HTTP 404` messaging with a clear message like: `Transport OK. SAP rejected username/password or SAP client.`
   - Include the attempt label in debug output to make support easier.

6. Correct setup guidance in the UI
   - Update `src/pages/SAPApiSettings.tsx` and `src/components/sapApi/SAPApiEditForm.tsx` to match the real architecture:
     - Lovable Cloud preview: app -> backend function -> ngrok -> local proxy -> SAP
     - Self-hosted: browser -> internal proxy -> SAP
   - Replace old `3002` examples with `3000`
   - Clarify that the “Node.js Middleware URL” is the base URL only, not `/proxy`

Files
- `supabase/functions/sap-sync/index.ts`
- `supabase/functions/sap-sync-scheduler/index.ts`
- `src/lib/sapSyncClient.ts`
- `src/pages/SAPApiSettings.tsx`
- `src/components/sapApi/SAPApiEditForm.tsx`

No database changes
- The current config row is already populated for this test: `vpn_tunnel`, ngrok URL, proxy secret `123456`, base URL `http://10.10.6.115:8000`, endpoint `/sap/api/zmrb01`, client `234`.
- No migration is needed.

Expected outcome
- Your existing global proxy stays as-is.
- Preview, self-hosted manual actions, and scheduled syncs all use the same compatible transport.
- The recurring “404” will be treated correctly as an SAP authentication/client-format issue instead of a missing ngrok route.
