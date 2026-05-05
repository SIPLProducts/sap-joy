## Why some Result Recording (eye) icons are disabled

In the MRB Worklist, each row has two action buttons:
- **View** (always enabled)
- **Result Recording** (the small `ScanEye` icon)

The Result Recording button is disabled whenever the row has no SAP Inspection Lot (`PRUEFLOS`), because the SAP `ZMRB_RESULT_RECORDING` RFC requires an Inspection Lot as input.

Database check:
- `quality_inspection` MRBs (29) — all have inspection_lot → enabled
- `inprocess` MRBs (3) — all have inspection_lot → enabled
- `shop_floor` MRBs (9) — none have inspection_lot → disabled

So the disabled icons you are seeing are all Shop-Floor-origin MRBs. Shop-Floor MRBs are created from MB52 stock blocks and never carry an SAP Inspection Lot, so Result Recording is not applicable to them.

## Fix: clearer tooltip on disabled rows

Keep the icon disabled, but make the tooltip explain *why* so users no longer think it is broken.

### Change

**File:** `src/pages/Worklist.tsx`

In both render branches (Inward/All-source table around line 1135 and the InProcess table around line 1322), replace the tooltip text:

```tsx
<TooltipContent>
  {mrb.inspectionLot
    ? 'Result Recording'
    : mrb.source === 'shop_floor'
      ? 'Not applicable for Shop Floor MRBs'
      : 'Inspection Lot not yet assigned'}
</TooltipContent>
```

No other code paths, DB migrations, edge functions, or RBAC changes are needed.

### Out of scope
- No change to enable/disable logic (button stays disabled when `inspectionLot` is missing).
- No change to `ResultRecordingModal` or SAP integration.
