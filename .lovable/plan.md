## Goal

Add a new "Quality Info" screen to the app, registered in the Role Access Matrix right after "MRB - InProcess Materials", and accessible from the sidebar. The screen shows a report with Material Code, Vendor Code, Plant, Date, and a Submit button per row.

## Changes

### 1. Register screen in Role Access Matrix

`src/pages/RoleMatrix.tsx` — add new entry in `SCREENS` right after `inward_materials`:

```
{ key: 'quality_info', label: 'Quality Info', group: 'Operations' }
```

This makes it appear in the Role Access Matrix exactly like the other tabs, so admins can toggle view/edit per role.

### 2. Sidebar entry

`src/components/layout/AppSidebar.tsx` — add menu item after "MRB Inprocess Materials":

```
{ title: 'Quality Info', url: '/quality-info', icon: ShieldCheck, matrixKey: 'quality_info' }
```

Visibility is controlled by `hasAccess('quality_info')`, identical to other items.

### 3. New page `src/pages/QualityInfo.tsx`

Layout follows existing report pages (sticky header, card, table).

Report table columns:
| Material Code | Vendor Code | Plant | Date | Action |

- **Data source**: pulled from existing inward inspection lot data (already has materialCode, vendorCode, plant, inspectionLotCreatedDate). Filtered by Active Plant from header context.
- **Date** displayed as `dd-MMM-yyyy`.
- **Submit button** in the Action column per row — opens a confirmation `AlertDialog` ("Submit quality info for &nbsp;?"). On confirm, marks the row as submitted (toast + disables the button + shows "Submitted" badge).
- Top-of-page filters: Material Code search, Vendor Code search, Date range — same pattern as Inward Report.

### 4. Route registration

`src/App.tsx` — add `/quality-info` route wrapped in `ProtectedRoute` + `AppLayout`, gated by `matrixKey="quality_info"`.

## Open questions

I'd like to confirm two details before building so the screen behaves correctly:

1. **Data source for the report rows** — should it pull from existing Inward (inspection lot) data filtered by the active plant, or do you want a new dedicated table populated by Quality (e.g., manual entry / SAP sync)?
2. **What does Submit do?** Options:
  - (a) Just mark the row as "submitted" locally (toast + disable button)
  - (b) Save a record into a new `quality_info` table with the four fields + submitter/timestamp
  - (c) Trigger an email / next workflow step

If you don't reply, I'll default to: **data from Inward inspection lots filtered by active plant**, and **Submit = save into a new `quality_info` table** (option b) so the action is auditable.