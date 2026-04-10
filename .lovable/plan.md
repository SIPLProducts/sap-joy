

## Fix: Display Batch No. in MRB Detail View

### Problem
The `batch` column is stored in `mrb_records` but neither `MRBDetail.tsx` nor `ShopFloorMRBDetail.tsx` display it. When viewing an MRB from the Worklist, the Batch No. value is missing.

### Change

**File: `src/pages/MRBDetail.tsx`** (line ~263-269)
- Add a "Batch No." card to the summary grid alongside Material, Vendor, Plant, PO, and Pending With:

```tsx
<Card>
  <CardHeader className="pb-2"><CardTitle className="text-sm">Batch No.</CardTitle></CardHeader>
  <CardContent><p className="font-medium">{mrb.batch || 'N/A'}</p></CardContent>
</Card>
```

- Update the grid from `md:grid-cols-5` to `md:grid-cols-6` to accommodate the new card.

**File: `src/pages/ShopFloorMRBDetail.tsx`**
- Similarly add "Batch No." display in the summary section for shop floor MRB records.

