

## Replace Browser `confirm()` with Styled AlertDialog

### Problem
The role deletion in Department Management (and also Plant Management and SAP API Settings) uses the browser's native `window.confirm()` dialog, which looks out of place and provides a poor user experience.

### Changes

**1. `src/pages/DepartmentManagement.tsx`**
- Remove `if (!confirm(...)) return;` from `handleDelete`
- Add state for `deleteTarget` (the department pending deletion)
- Add an `AlertDialog` component that shows when `deleteTarget` is set, with:
  - Title: "Delete Role"
  - Description: `Are you sure you want to delete role "{name}"? This may affect users assigned to this role.`
  - Cancel button and a destructive-styled Confirm button
- On confirm, run the existing delete logic and clear `deleteTarget`

**2. `src/pages/PlantManagement.tsx`** (same pattern)
- Replace `confirm()` with AlertDialog for plant deletion

**3. `src/pages/SAPApiSettings.tsx`** (same pattern)
- Replace `confirm()` with AlertDialog for config deletion

All three pages will import from `@/components/ui/alert-dialog` which already exists in the project. No database changes needed.

