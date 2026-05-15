## Issue

The Create MRB button on **Inward Materials** and **In-Process Materials** is gated by a hardcoded role list:

```ts
const canCreateMRB = userRole && ['quality', 'quality_head', 'admin'].includes(userRole);
```

`superadmin` is not in this list, so the button (and per-row "Create MRB" action) never renders for superadmin users — even though superadmin already has full backend access via `has_role()` and `has_screen_access()` (which treat superadmin as universal except for `sap_api_settings` / `sap_sync_monitor`).

The same hardcoded check also gates `canEditQuantity` on the In-Process screen.

## Fix

Add `superadmin` to the allowed role lists in both pages — frontend-only, two files.

### 1. `src/pages/InwardReport.tsx`
- Update `canCreateMRB` to include `'superadmin'`:
  ```ts
  const canCreateMRB = userRole && ['quality', 'quality_head', 'admin', 'superadmin'].includes(userRole);
  ```

### 2. `src/pages/InwardInProcessReport.tsx`
- Update `canCreateMRB` to include `'superadmin'`.
- Update `canEditQuantity` to include `'superadmin'` (so superadmin can also edit transaction quantities, consistent with "all access except SAP API/Sync screens").

## Out of scope
- No backend / RLS changes (already permit superadmin).
- No changes to other role gates elsewhere; this plan only addresses the two reported screens. If you'd like a broader sweep replacing all hardcoded role checks with `superadmin`-aware logic across the app, say so and I'll do a separate pass.
