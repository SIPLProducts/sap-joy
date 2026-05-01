## Issue

A new MRB created from the **MRB - Inward InProcess** tab is being saved with `source = 'inprocess'` correctly in the database, but the **MRB Worklist** displays it with the orange **"Shop Floor"** badge. This is because `getSourceBadge()` in `Worklist.tsx` only checks for `'quality_inspection'` and falls through to "Shop Floor" for everything else (including the new `inprocess` value).

The same fall-through issue affects: source filter dropdown, Excel export, and the row-click navigation route.

## Fix

### 1. `src/pages/Worklist.tsx`

**a. Source badge (line ~272–277)** — add an explicit `inprocess` branch:
```tsx
const getSourceBadge = (source: MRBSource) => {
  if (source === 'quality_inspection') {
    return <Badge ... className="bg-blue-50 text-blue-700 border-blue-200">Inward</Badge>;
  }
  if (source === 'inprocess') {
    return <Badge ... className="bg-purple-50 text-purple-700 border-purple-200">InProcess</Badge>;
  }
  return <Badge ... className="bg-orange-50 text-orange-700 border-orange-200">Shop Floor</Badge>;
};
```

**b. Source-type union & filter dropdown (lines 52, 958–966)** — extend type and add option:
```tsx
type SourceType = 'all' | 'quality_inspection' | 'shop_floor' | 'inprocess';
...
<SelectItem value="inprocess">Inward InProcess</SelectItem>
```

**c. Excel export label (line 341)** — map `inprocess` to "Inward InProcess":
```tsx
'Source': mrb.source === 'quality_inspection' ? 'Inward'
        : mrb.source === 'inprocess' ? 'Inward InProcess'
        : 'Shop Floor',
```

**d. Row-click navigation (lines 404–411)** — route `inprocess` records to the inward MRB detail page (it already reads from `mrb_records` by id):
```tsx
if (mrb.source === 'quality_inspection' || mrb.source === 'inprocess') {
  navigate(`/inward/mrb/${mrb.id}`);
} else if (mrb.source === 'shop_floor') {
  navigate(`/shop-floor/mrb/${mrb.id}`);
} else {
  navigate(`/mrb/${mrb.id}`);
}
```

### 2. `src/pages/Dashboard.tsx`

The "Recent Activity" card displays `Shop Floor` / `Quality Inspection` based on source and links via the same logic. Update both:
- Display label: show "Inward InProcess" when `source === 'inprocess'`.
- Link target: route `inprocess` to `/inward/mrb/${id}` (same as quality_inspection).

## QA after fix

1. Open MRB Worklist → the MRB created from "Inward InProcess" now shows a purple **"InProcess"** badge (not orange Shop Floor).
2. Source filter dropdown has a new option **"Inward InProcess"**; selecting it shows only inprocess MRBs.
3. Click the InProcess MRB row → opens the inward MRB detail page successfully.
4. Excel export → Source column reads "Inward InProcess" for that MRB.
5. Dashboard recent activity → label and link work for inprocess records.

## Out of scope

- No DB / migration changes — `mrb_source` enum already includes `inprocess` and the record was saved correctly.
- No changes to the InProcess creation flow itself.
