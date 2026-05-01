## Goal

Add a new screen **"MRB - Inward InProcess"** (parallel to "MRB - Inward Materials") that lists inspection lots fetched from the **ZMRB04** SAP API (already syncing to `zmrb_inward_report` table) and lets eligible users create MRB records from them. New MRBs created from this screen will carry source = `inprocess`. The screen must be governed by the Role Access Matrix.

Also rename the existing module label "MRB - Inward Materials" → keep wording consistent (the user wrote "change report to process"; this refers to the new screen's data source/wording — we'll label the new module **"MRB - Inward InProcess"** while leaving the existing Inward Materials screen untouched).

## Plan

### 1. Database changes (migration)

- Extend the `mrb_source` enum to add a third value: `inprocess`.
  ```sql
  ALTER TYPE public.mrb_source ADD VALUE IF NOT EXISTS 'inprocess';
  ```
- No new tables needed — `zmrb_inward_report` already exists and is being populated by the SAP sync (ZMRB04 ART=04). It already has the same shape as `inward_inspection_lots` (vendor, PO, GRN, batch, qty, etc.).
- Seed `role_permissions` for the new `module_key = 'inward_inprocess'` (label: "MRB - Inward InProcess") for plant 1300 across all existing roles with `can_view = false, can_edit = false` (admin gets true). Master Admin already bypasses.

### 2. New page: `src/pages/InwardInProcessReport.tsx`

- Clone of `InwardReport.tsx` adapted to read from `zmrb_inward_report` instead of `inward_inspection_lots`.
- Same UI: filters (plant, material, vendor, storage location, inspection lot, posting date range), search, pagination, multi-select bulk MRB creation, single-row "Create MRB", inline qty edit (when allowed), live SAP sync indicator showing the ZMRB_Inward_Process config's `last_sync_at`.
- Reuse `MultiSelectFilter`, dynamic-fields hook (`useExtraDynamicFields('zmrb_inward_report')`), and the same role-based permission gates (`quality`, `quality_head`, `admin` can create / edit qty).

### 3. New context: `src/contexts/InwardInProcessMRBContext.tsx`

- Mirror of `InwardMRBContext.tsx` but:
  - Reads from `zmrb_inward_report` (instead of `inward_inspection_lots`).
  - When creating an MRB, sets `source = 'inprocess'` on the inserted `mrb_records` row.
  - Updates lot status back into `zmrb_inward_report` after MRB creation (`status = 'mrb_created'`).
- Wrap the app with this provider in `src/App.tsx` (alongside existing `InwardMRBProvider`).

### 4. New "Create MRB" page: `src/pages/CreateInwardInProcessMRB.tsx`

- Clone of `CreateInwardMRB.tsx`. Only differences:
  - Loads inspection-lot details from `zmrb_inward_report` (not `inward_inspection_lots`).
  - Saves MRB with `source: 'inprocess'`.
  - On save, updates the source row in `zmrb_inward_report.status` to `mrb_created`.

### 5. Routing (`src/App.tsx`)

Add three routes inside the protected layout:
- `/inward/inprocess` → `InwardInProcessReport`
- `/inward/inprocess/create-mrb` → `CreateInwardInProcessMRB`
- `/inward/inprocess/mrb/:id` → reuse existing `InwardMRBDetail` (it reads from `mrb_records` by id; works regardless of source)

### 6. Sidebar entry (`src/components/layout/AppSidebar.tsx`)

Add menu item right after "MRB - Inward Materials":
```
{ title: 'MRB - Inward InProcess', url: '/inward/inprocess', icon: Layers, matrixKey: 'inward_inprocess' }
```
Visibility driven by `hasAccess('inward_inprocess')` from the Role Matrix.

### 7. Role Access Matrix (`src/pages/RoleMatrix.tsx`)

Add a new row to the `SCREENS` array under the `Operations` group:
```
{ key: 'inward_inprocess', label: 'MRB - Inward InProcess', group: 'Operations' }
```
This makes the screen toggleable per role/plant in the existing matrix UI. Combined with the seeded `role_permissions` rows from step 1, admins can grant access role-by-role.

### 8. Worklist / KPI / Dashboards

Existing worklist already reads `mrb_records` regardless of source — `inprocess` records will appear automatically. No changes needed there. (Optional: a future filter chip for "InProcess" can be added later.)

## Out of scope

- No changes to existing **Inward Materials** screen, its context, or the `inward_inspection_lots` data path.
- No changes to ZMRB01 vs ZMRB04 SAP configs (you've already configured `ZMRB_Inward_Process` to write into `zmrb_inward_report`).
- No new SAP edge function — sync already lands in the right table.

## QA after implementation

1. Apply migration → verify `mrb_source` enum includes `inprocess`; verify seeded `role_permissions` rows for `inward_inprocess`.
2. As Master Admin, open Role Access Matrix → confirm new row "MRB - Inward InProcess" appears under Operations and is toggleable.
3. Toggle it ON for `quality` role → log in as quality user → confirm new sidebar item visible.
4. Open `/inward/inprocess` → confirm rows from `zmrb_inward_report` are listed with the same columns/filters as Inward Materials.
5. Select rows → bulk Create MRBs → confirm new `mrb_records` rows have `source = 'inprocess'`, source row status flips to `mrb_created`.
6. Single Create MRB flow → confirm form pre-fills from `zmrb_inward_report` and saved MRB carries `source = 'inprocess'`.
7. Open the created MRB from worklist → details page renders correctly.
