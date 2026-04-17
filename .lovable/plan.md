

The user is reiterating the prior plan: the Inward MRB print must match `NON_Conformance_Report_IQC.pdf` and Shop Floor MRB print must match `EG-QC-FT-502_Rev0_Non_conformity_Report.pdf`. The previous branding plan was approved and applied, but the actual two-format split in `MRBPrint.tsx` was never implemented. Re-presenting the focused plan.

## Auto-Format MRB Print: Inward (IQC) vs Shop Floor (EG-QC-FT-502)

### Mapping
| MRB Source | Print Layout |
|---|---|
| `inward` | NON-CONFORMANCE REPORT (IQC) — matches `NON_Conformance_Report_IQC.pdf` |
| `shop_floor` | NON-CONFORMITY REPORT — matches `EG-QC-FT-502_Rev0_Non_conformity_Report.pdf` |

### Changes in `src/pages/MRBPrint.tsx`

1. **Remove manual tab switching.** Drop the NCR/MRB `Tabs` UI and `activeForm` state. Replace with a read-only badge in header showing the auto-resolved format name.

2. **Auto-resolve format from MRB source:**
   ```ts
   const formType = selectedMRB?.source === 'shop_floor' ? 'shop_floor_ncr' : 'inward_ncr';
   ```
   Default to `inward_ncr` if source is missing.

3. **Rename existing `NCRReport` → `InwardNCRReport`** (already matches IQC layout: GRN, NC Report No, Supplier, PO, Item grid, MRB approval table, Disposition, NCR Status, footer doc `HBL/QA/NCR/001`).

4. **Add new `ShopFloorNCRReport` component** matching EG-QC-FT-502:
   - Header: HBL Engineering Limited / Rail Signaling Division + logo
   - Title: **NON-CONFORMITY REPORT**
   - **INITIATOR** grid: NCR # | Part #/Qty | Lot/Serial #'s | Vendor (if applicable)
   - Initiator Name + Date
   - **Material / Product Description**
   - **Deviation Summary** (combines `defect_description` + `defect_remarks`)
   - **Disposition** checkboxes: Use As Is / Sort / Return to Vendor / Rework / Scrap / Others (reuse `getDispositionChecked`)
   - **Approvals table**: Department / Name / Sign / Date (from approver names + `mrb_approval_history`)
   - **NCR Close out** + CLOSED/OPEN status boxes
   - Footer doc: `EG-QC-FT-502`, Rev `0`

5. **Single shared `printRef`** — conditional render:
   ```tsx
   {formType === 'shop_floor_ncr'
     ? <ShopFloorNCRReport ref={printRef} ... />
     : <InwardNCRReport ref={printRef} ... />}
   ```

6. **Update print/download/preview handlers** to use the single ref. PDF filenames:
   - Inward → `NCR_IQC_<mrb_number>.pdf`
   - Shop Floor → `NCR_EGQC_<mrb_number>.pdf`

### Files to modify
1. `src/pages/MRBPrint.tsx` — only file changed.

### Result
Opening Print on an Inward MRB auto-renders the IQC layout; opening it on a Shop Floor MRB auto-renders the EG-QC-FT-502 layout. No manual selection. Print, Preview, and Download PDF all act on the correct format.

