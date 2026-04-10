

## Fix Edge Functions for Self-Hosted Supabase

### Root Cause

The "InvalidWorkerCreation: could not find an appropriate entrypoint" error happens because:

1. **The main router uses dynamic `import()` to load each function** — but each function file calls `Deno.serve()` at the top level. When the router imports a function, that `Deno.serve()` call fires immediately, conflicting with the router's own `Deno.serve()`.
2. **The `test-smtp` function was added after the last `deploy-edge-functions.sh` run** — so the main router file on your server doesn't include a route for it.
3. **ZMRB01 (sap-sync) works** likely because it was the first function loaded or cached, but the router architecture is fundamentally broken for multi-function routing.

### Fix

**Rewrite the deploy script to create proper wrapper files** instead of importing raw function files that contain `Deno.serve()`.

The approach:
- For each function (`create-user`, `sap-sync`, `send-mrb-email`, `test-smtp`, `seed-demo-users`), the deploy script will create a **wrapper** version where `Deno.serve(handler)` is replaced with `export default handler` — so the main router can import and call the handler without conflicting `Deno.serve()` registrations.
- The main router remains the single `Deno.serve()` entrypoint that dispatches to each function's exported handler.

### Changes

**1. Update `deploy/deploy-edge-functions.sh`**
- In step 2 (copy functions), after copying each `index.ts`, also create a `handler.ts` wrapper by:
  - Reading the original `index.ts`
  - Using `sed` to replace `Deno.serve(async (req)` → `export default async (req: Request)` (and `Deno.serve({ port }, async (req)` variant)
  - Also replacing the old `serve(async (req)` pattern used by `seed-demo-users`
  - Writing the result as `handler.ts` alongside the original
- In step 3 (main router), change imports from `'../{fn}/index.ts'` to `'../{fn}/handler.ts'` — these export a default handler function, no `Deno.serve()` conflict.

**2. Output an updated deploy script + instructions**

The deliverable will be:
- Updated `deploy/deploy-edge-functions.sh` with the wrapper generation logic
- A step-by-step guide to run on your server

### Deployment Steps (for your server)

```text
1. Pull latest code:
   cd /opt/MRB/frontend && git pull

2. Rebuild frontend:
   npm ci && npm run build

3. Re-deploy edge functions:
   sudo bash deploy/deploy-edge-functions.sh

4. Verify all endpoints:
   curl -X POST http://10.10.4.178:8000/functions/v1/test-smtp \
     -H "Authorization: Bearer <anon_key>" \
     -H "Content-Type: application/json" \
     -d '{"test": true}'
```

### Files to Modify
- `deploy/deploy-edge-functions.sh` — rewrite step 2 to generate `handler.ts` wrappers, update step 3 router to import handlers

