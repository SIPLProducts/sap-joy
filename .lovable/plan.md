## Goal

Make plant scoping uniform across the entire app:

- **Master Admin** (`masteradmin@sharviinfotech.com`) — sees and can pick **every plant** in the system.
- **Everyone else** (including role `admin`) — sees only the plants explicitly assigned to them in `user_plants`, in **every** plant dropdown, filter, and management screen.

The existing `useVisiblePlants()` already enforces "assigned plants only", but several screens still bypass it by querying `supabase.from('plants').select(...)` directly. Those bypasses are the source of the issue.

## Changes

### 1. Central hook — single source of truth

**`src/hooks/useVisiblePlants.ts`**
- Detect Master Admin via `useAuth()` (`profile?.email` / `user?.email` === `masteradmin@sharviinfotech.com`).
- If Master Admin → return **all plants** from `usePlants()` (codes + names).
- Otherwise → return only `user_plants` joined with the global plants list (so labels like "1100 - Vizag plant" still work).
- Return shape: `{ visiblePlants: string[], plantOptions: { code, name }[], isMaster: boolean, loading }`.

This becomes the only place that decides "what plants can this user see".

### 2. Replace direct `from('plants')` calls in admin/config screens

Each of these currently fetches the **entire** plants table — they will be switched to `useVisiblePlants()` so non‑master admins see only their assigned plants:

- `src/pages/RoleMatrix.tsx` (plant selector for role‑permission matrix)
- `src/pages/UserPermissionMatrix.tsx` (plant selector)
- `src/pages/WorkflowRoutingConfig.tsx` (plant selector)
- `src/pages/EmailConfiguration.tsx` (SMTP + template plant selectors)
- `src/pages/PlantManagement.tsx` (list of plants the admin can manage — non‑master admins see/edit only their assigned plants; Master Admin sees all)
- `src/pages/UserManagement.tsx` — when assigning plants to a user, the admin can only pick from his own visible plants (Master Admin can pick any). Display of already‑assigned plants on existing users is unchanged.
- `src/components/sapApi/SAPApiEditForm.tsx` (scheduler plant multi‑select)
- `src/pages/UserProfile.tsx` (default‑plant picker)

### 3. Default selected plant

Screens that hard‑code `useState('1300')` (RoleMatrix, UserPermissionMatrix, WorkflowRoutingConfig) will default to:
- `profile.plant` if it is in `visiblePlants`, else
- `visiblePlants[0]`.

When `visiblePlants.length === 1` the dropdown is auto‑selected and disabled (same pattern already used in dashboards and Material Blocking).

### 4. Header plant switcher

`AppHeader.tsx` already uses `useUserPlants` directly. Switch it to `useVisiblePlants()` so Master Admin sees **all** plants in the header switcher and can change the active plant globally.

### 5. Memory

Update `mem://features/strict-plant-scoping`:
- "Master Admin (`masteradmin@sharviinfotech.com`) is the only role that sees all plants. Every other user — including `admin` — is restricted to `user_plants` in every dropdown, filter, and management screen. The decision lives in `useVisiblePlants()`."

## Out of scope

- No DB / RLS changes. RLS already enforces `user_has_plant`; this is purely a UI scoping pass.
- No changes to data fetched for MRB / Inward / Stock lists — those are already RLS‑filtered.
- No removal of admin functionality; admins keep full CRUD on their assigned plants.

## Files to touch

- `src/hooks/useVisiblePlants.ts` (rewrite)
- `src/components/layout/AppHeader.tsx`
- `src/pages/RoleMatrix.tsx`
- `src/pages/UserPermissionMatrix.tsx`
- `src/pages/WorkflowRoutingConfig.tsx`
- `src/pages/EmailConfiguration.tsx`
- `src/pages/PlantManagement.tsx`
- `src/pages/UserManagement.tsx` (only the "assign plants" picker)
- `src/pages/UserProfile.tsx`
- `src/components/sapApi/SAPApiEditForm.tsx`
- Memory file `mem://features/strict-plant-scoping`
