

## Fix: User Deletion Not Actually Working

### Root Cause

Two problems:

1. **No DELETE RLS policy on `profiles` table** — The `profiles` table only has SELECT, INSERT, and UPDATE policies. There is no DELETE policy, so `supabase.from('profiles').delete()` silently fails (returns 0 rows affected but no error thrown).

2. **Auth user not deleted** — The code only deletes from `profiles`, `user_roles`, `user_plants`, and `user_security` tables. It never deletes the actual auth user record, which requires the Admin API (`auth.admin.deleteUser`). So even if table rows were cleaned up, the user could still log in.

3. **No error checking** — The delete calls don't check the `.error` property from each Supabase response, so the code always reaches the "success" toast.

### Fix

**1. Add `delete_user` action to the `create-user` Edge Function** (`supabase/functions/create-user/index.ts`)
- Add a new `action === "delete_user"` handler
- Accept `user_id` in the request body
- Use `adminClient.auth.admin.deleteUser(user_id)` to delete the auth user (this cascades or we manually clean up related tables first)
- Clean up `user_roles`, `user_plants`, `user_security`, `password_history`, `profiles` using the admin client (bypasses RLS)

**2. Update `handleDeleteUser` in `src/pages/UserManagement.tsx`**
- Replace the four direct Supabase delete calls with a single `supabase.functions.invoke('create-user', { body: { action: 'delete_user', user_id: ... } })`
- Check the response for `ok: false` and show the error message
- Only show success toast when `ok: true`

### Files to modify
1. `supabase/functions/create-user/index.ts` — add `delete_user` action
2. `src/pages/UserManagement.tsx` — update `handleDeleteUser` to call the edge function

No database migrations needed.

