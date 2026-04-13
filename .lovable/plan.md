

## Fix: Allow non-admin roles with User Management permission to create users

### Problem
The `create-user` edge function on line 61 hardcodes `roleData?.role !== "admin"` as the authorization check. Users granted the "User Management" screen permission in the Role Access Matrix still get "Only admins can manage users" because the edge function ignores screen-level permissions.

### Fix
Update the edge function to also check the `role_permissions` table for `user_management` screen access, matching the pattern already used by `has_screen_access()` DB function and the frontend `hasAccess('user_management')` check.

### Changes

**File: `supabase/functions/create-user/index.ts`**
- Replace the simple `role !== "admin"` check (lines 59-63) with a two-step check:
  1. Check if user has role `admin` (existing check)
  2. OR check if user has `can_view = true` for `module_key = 'user_management'` in `role_permissions` table
- Use the `adminClient` (service role) for the permission query to avoid RLS recursion

```typescript
// Check if calling user is admin OR has user_management screen access
const { data: roleData } = await anonClient.from("user_roles").select("role").eq("user_id", callingUser.id).maybeSingle();
const isAdmin = roleData?.role === "admin";

let hasUserMgmtAccess = false;
if (!isAdmin && roleData?.role) {
  const { data: permData } = await adminClient.from("role_permissions")
    .select("can_view")
    .eq("role", roleData.role)
    .eq("module_key", "user_management")
    .eq("can_view", true)
    .maybeSingle();
  hasUserMgmtAccess = !!permData;
}

if (!isAdmin && !hasUserMgmtAccess) {
  return jsonResponse({ ok: false, error: "Only admins can manage users" });
}
```

Note: The `adminClient` initialization must be moved before this check since we need it for the permission query.

### No database or migration changes needed.

