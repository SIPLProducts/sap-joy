## Goal
Introduce a new hardcoded `superadmin` role:
- Sees **all plants** automatically (like Master Admin) — no `user_plants` assignment needed.
- **Cannot** access **SAP API Settings** or **SAP Sync Monitor** (those remain Master-Admin-only).
- Access to every other screen is governed by the **Role Access Matrix** (so admin can grant/revoke).

## Changes

### 1. Database — RLS plant scoping
Update `public.user_has_plant(_user_id, _plant)` to also return `true` when the user has the `superadmin` role in `user_roles`. This automatically grants all-plant visibility on `mrb_records`, `mrb_attachments`, `mrb_approval_history`, `inward_inspection_lots`, `zmrb_inward_report`, `shop_floor_stock`.

```sql
CREATE OR REPLACE FUNCTION public.user_has_plant(_user_id uuid, _plant text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    _plant IS NULL
    OR EXISTS (SELECT 1 FROM public.profiles p
               WHERE p.user_id = _user_id
                 AND p.email = 'masteradmin@sharviinfotech.com')
    OR EXISTS (SELECT 1 FROM public.user_roles ur
               WHERE ur.user_id = _user_id AND ur.role = 'superadmin')
    OR EXISTS (SELECT 1 FROM public.user_plants up
               WHERE up.user_id = _user_id AND up.plant_code = _plant);
$$;
```

### 2. Frontend — plant visibility
`src/hooks/useVisiblePlants.ts`: treat `userRole === 'superadmin'` the same as Master Admin → return all plants from `usePlants()`. Plant switcher in the header will then list every plant for superadmins.

### 3. Frontend — role gating
- `src/hooks/useRoleMatrix.ts` `hasAccess`: keep matrix-driven (do NOT auto-grant for superadmin — admin must configure permissions via the Role Access Matrix). Same for `canEdit`.
- `src/components/layout/AppSidebar.tsx`: `isMasterAdmin` stays unchanged so SAP API Settings & SAP Sync Monitor remain master-only. Admin section already filters by `hasAccess(matrixKey)` for non-`admin` roles, so superadmin will only see admin items the matrix grants.
- `src/contexts/RoleContext.tsx` `mapAppRoleToUserRole`: map `superadmin` → `plant_head` (legacy compatibility).

### 4. Seed the new role
Insert `superadmin` into `departments` (so it appears in Role Management UI / matrix dropdowns) and pre-seed Role Access Matrix entries (`role_permissions`) with `can_view=true` for all screens **except** `sap_api_settings` and `sap_sync_monitor`, across all existing plants.

### 5. Master Admin guard for SAP screens
`/admin/sap-api` and `/admin/sap-sync` already render under `MasterAdminGuard` (via `masterOnly: true` in sidebar) — confirm route-level guard. If routes are not wrapped in `MasterAdminGuard`, wrap them in `src/App.tsx` so a superadmin typing the URL still gets blocked.

## Technical notes
- Role key is hardcoded `superadmin`; assigned to a user via existing User Management UI by inserting into `user_roles`.
- No schema additions needed — `user_roles.role` is already free-form text.
- RLS function change is the single source of truth for "all plants" — no app code needs to union plants.
- Master Admin behavior is unchanged.

## Out of scope
- No new edge functions.
- No UI for managing the `superadmin` role itself beyond the existing Role Access Matrix.
