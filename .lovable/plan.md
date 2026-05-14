## Goal
Refine the User Management create/edit dialogs for the `superadmin` role:

1. Show the role label as **"Super Administrator"** only — hide the description text (which currently shows "Cross-plant administrator (excludes SAP API & Sync screens)" in parentheses).
2. Hide the **Assign Plants** section entirely when the selected role is `superadmin`, since superadmin already has access to every plant via the RLS function.

## Changes — `src/pages/UserManagement.tsx`

### Create User dialog (~line 616)
- In the role `<SelectItem>` render, suppress the `role.description` line when `role.value === 'superadmin'`.
- Wrap the **Assign Plants** block (~line 628–644) with `{newUserRole !== 'superadmin' && (...)}`.
- In `handleCreateUser`, skip the `user_plants` insert when `newUserRole === 'superadmin'` (set/clear `newUserPlants` to `[]` for that role).
- Remove `Assign Plants` from the form's required validation when role is superadmin (it isn't required today, but keep create button enabled regardless).

### Edit User dialog (~line 679)
- Same change to the `<SelectItem>` description suppression.
- Wrap the **Assigned Plants** block (~line 691–718) with `{selectedRole !== 'superadmin' && (...)}`.
- In `handleSaveUser`, when `selectedRole === 'superadmin'`, delete any existing `user_plants` rows for that user (so prior assignments don't linger) and skip the insert.

### Display polish
- Optional: in the user list table, when role is `superadmin`, show the role badge as "Super Administrator" with no plant chips (already driven by `selectedUser.plants`, which will be empty after save). No extra change needed beyond the save logic.

## Out of scope
- No DB migration. The existing `superadmin` department row and `user_has_plant()` function continue to work.
- Master Admin behavior unchanged.
