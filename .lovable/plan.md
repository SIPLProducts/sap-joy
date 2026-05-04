## Goal
Replace the wrench (spanner) icon in the sidebar header with the existing HBL logo image.

## Change
**File:** `src/components/layout/AppSidebar.tsx` (header block, ~lines 96–108)

In the `SidebarHeader`, replace the icon container:

Before:
```tsx
<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sidebar-primary">
  <Wrench className="h-5 w-5 text-sidebar-primary-foreground" />
</div>
```

After:
```tsx
<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white p-1 shrink-0">
  <img src={hblLogo} alt="HBL" className="h-full w-full object-contain" />
</div>
```

Also add at the top of the file:
```tsx
import hblLogo from '@/assets/hbl-logo.png';
```

The `Wrench` import stays (still used elsewhere in `menuItems` for "Material Blocking" wait—no, that uses `Wrench` for Engineering Dashboard). Keep the `Wrench` import as it's still referenced in `dashboardItems`.

## Out of scope
- Sidebar title text "HBL MRB" / subtitle remain unchanged.
- Other icons in the sidebar are unchanged.
- Login page / print page logos remain unchanged.

## Verification
Open the app → sidebar header shows the HBL logo (white-bg rounded square) instead of the spanner icon, next to the "HBL MRB" title.