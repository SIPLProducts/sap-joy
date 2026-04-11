

## Fix: "Error sending confirmation email" on User Creation

### Problem
The app creates users via `supabase.auth.signUp()`, which triggers Supabase's built-in email confirmation flow. On your self-hosted server, if the Auth SMTP isn't configured (or GoTrue can't send mail), this fails with "Error sending confirmation email."

### Solution
Replace `signUp()` with the `create-user` edge function that already exists in your project. That function uses `admin.createUser({ email_confirm: true })` — which **skips email verification entirely** and creates the user as already confirmed. No email is sent.

### Changes

**File: `src/pages/UserManagement.tsx`** — In `handleCreateUser()`:

1. **Remove** the `tempClient` creation and `tempClient.auth.signUp()` call (lines 335-354)
2. **Replace** with a `supabase.functions.invoke('create-user', ...)` call that sends: `email`, `password`, `full_name`, `role`, `department`, `plant`
3. The edge function already handles: user creation (no email), profile update, role assignment, password history, and user_security record
4. After the edge function returns the `user_id`, continue with the existing `user_plants` upsert logic (lines 370-373) since the edge function doesn't handle multi-plant assignment
5. Remove the now-redundant profile update, role insert, password history, and user_security insert code (lines 361-389) since the edge function handles all of that

### What stays the same
- All validation logic (duplicate email/employee ID checks)
- Plant assignment via `user_plants` table
- UI, dialog, form fields — no visual changes
- The `create-user` edge function already exists and works on your server

### Deployment
After this change: `git pull && npm ci && npm run build` on your server. No edge function redeployment needed — `create-user` is already deployed.

