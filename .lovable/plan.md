

## Add Block Reason to Create MRB Form + Hide MRB-Created Records

### Changes

**1. `src/pages/CreateInwardMRB.tsx`** — Show Block Reason field
- Replace the comment on line 807 (`{/* Block Reason hidden from create form */}`) with a read-only Block Reason input field, placed between Transaction Quantity and Vendor Code (matching the screenshot layout).

```tsx
<div className="space-y-2">
  <Label className="text-muted-foreground">Block Reason</Label>
  <Input value={formData.blockReason} readOnly className="bg-muted" />
</div>
```

**2. `src/contexts/InwardMRBContext.tsx`** — Filter out `mrb_created` records
- After building the `lotRecords` array (~line 180), filter out records with `status === 'mrb_created'` before calling `setInspectionLotRecords`, so they never appear in the Inward Report.

**3. `src/pages/InwardReport.tsx`** — Safety filter
- In `handleSearch` (line 245) and the auto-load `useEffect` (line 253), add `.filter(r => r.status !== 'mrb_created')` as a safeguard.

