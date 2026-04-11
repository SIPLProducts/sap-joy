

## Fix: Edge Function "non-2xx status code" error on user creation

### Problem
The `create-user` edge function returns HTTP 400/401/403/500 for errors. The Supabase JS SDK throws a generic "Edge Function returned a non-2xx status code" exception for any non-200 response, swallowing the actual error message. This is exactly the pattern described in the project's own memory (`edge-function-response-protocol`): the `sap-sync` function already solved this by always returning HTTP 200.

### Fix
Change `create-user/index.ts` to **always return HTTP 200**, with the error details in the JSON body using an `{ ok, error, data }` pattern. The frontend already handles `createData?.error` on line 351, so it will display the real error message.

### Changes

**File: `supabase/functions/create-user/index.ts`**
- Replace all `status: 401/400/403/500` responses with `status: 200`
- Wrap all responses in `{ ok: true/false, error?, user_id?, message? }` format
- Keep CORS headers on all responses

**File: `src/pages/UserManagement.tsx`** (minor)
- Update error check to use `createData?.ok === false` pattern for clearer error extraction

### No database or migration changes needed.

