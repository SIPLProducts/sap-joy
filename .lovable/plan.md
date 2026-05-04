## Goal
Rename the page heading on the In-Process Materials screen from "MRB - Inward InProcess" to "MRB Inprocess Materials" so it matches the sidebar label.

## Change

### `src/pages/InwardInProcessReport.tsx` (line 519)
Replace:
```tsx
<h1 className="text-xl font-bold text-foreground">MRB - Inward InProcess</h1>
```
with:
```tsx
<h1 className="text-xl font-bold text-foreground">MRB Inprocess Materials</h1>
```

## Out of scope
- Sidebar label (already "MRB Inprocess Materials").
- Worklist source filter dropdown ("Inward InProcess") — that labels the data source, not this screen.
- Create MRB page title ("Create MRB – Inward InProcess") — different screen.
- Role Matrix admin label — internal admin config.
- Route paths and context/component identifiers — unchanged.

## Verification
Navigate to `/inward/inprocess` → page header reads "MRB Inprocess Materials".