
Goal

Get admin user creation working without any confirmation email.

What I confirmed

- `src/pages/UserManagement.tsx` already creates users through `supabase.functions.invoke('create-user')`.
- `supabase/functions/create-user/index.ts` already uses `auth.admin.createUser({ email_confirm: true })`, which is the correct no-email path.
- Your latest server log shows the immediate blocker is different: the self-hosted edge runtime is crashing because the generated `sap-sync/handler.ts` is invalid (`Expected ';', got ')'` at line 570).
- Because the main edge router statically imports every function handler, one broken `sap-sync` handler prevents all edge functions from starting, including `create-user`.
- If the browser still shows “failed to send confirmation email”, production is also likely serving an older frontend bundle that still hits signup.

Plan

1. Fix the self-hosted edge router
- Update `deploy/deploy-edge-functions.sh` so it prefers a checked-in `handler.ts` when present.
- Keep auto-generated wrappers only as a fallback for simple functions.

2. Stop auto-parsing `sap-sync`
- Add `supabase/functions/sap-sync/handler.ts` with an explicit exported request handler.
- Refactor `supabase/functions/sap-sync/index.ts` to share the same logic cleanly, instead of relying on the brittle wrapper extraction.

3. Restore the real user-creation path
- Re-deploy edge functions after the router fix so `create-user` is reachable again.
- Keep `create-user` as the only admin provisioning path; no confirmation email flow will be used.

4. Refresh production frontend
- Rebuild and redeploy the frontend bundle from `/opt/MRB_NEW`.
- Make sure the live site serves the updated bundle instead of cached/stale JS.

5. Verify end to end
- From User Management, confirm the request goes to `/functions/v1/create-user`.
- Confirm there is no request to `/auth/v1/signup`.
- Confirm the user is created successfully with no email-confirmation error.

Files to change

- `deploy/deploy-edge-functions.sh`
- `supabase/functions/sap-sync/index.ts`
- `supabase/functions/sap-sync/handler.ts`

Expected result

- Edge functions boot successfully again.
- `create-user` works in production.
- Admin-created users are created immediately without sending any confirmation email.
