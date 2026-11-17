# Add PO Date, DC/INV No and DC/INV Date from SAP to the Print Form

Additive only. No existing code paths or logic are removed or changed; new fields are added next to the current ones, and current fallbacks stay as they are.

## What the user will see
- Print form "PO No. & Date" shows the PO date from SAP (BEDAT).
- "DC / INV No." shows SAP DCNUMBER (or INVOICE).
- "DC / INV Date" shows SAP DC_DATE (or IN_DATE).
- Works for new Inward MRBs, and for older MRBs by looking up the matching inspection lot.

## Steps
1. **Database (additive):** add nullable text columns `po_date`, `dc_invoice_no`, `dc_invoice_date` to `inward_inspection_lots` and `mrb_records`. No changes to existing columns or access rules.
2. **SAP refresh mapping (`sapSyncClient.ts`, scheduler fallback map):** add the three columns to the allowed list and add aliases:
   - `bedat` -> `po_date`
   - `dcnumber`, `invoice` -> `dc_invoice_no`
   - `dc_date`, `in_date` -> `dc_invoice_date`
   Existing mappings (including `bldat` -> `grn_date`) remain untouched.
3. **Inward MRB creation:** copy the three values from the selected inspection lot into the new MRB record (added fields only).
4. **Print form (`MRBPrint.tsx`):** prefer the new fields; if empty, read them from `inward_inspection_lots` by inspection lot; otherwise keep the current fallback. Format SAP `YYYYMMDD` dates as DD.MM.YYYY.
5. **Types:** regenerate backend types.

## Deployment note (QLTY/PRD)
- Run the new migration SQL, rebuild frontend, redeploy `sap-sync` and `sap-sync-scheduler` functions.
- In SAP API Settings -> ZMRB_Inward_Inspection -> Fields, optionally add response fields BEDAT, DCNUMBER, INVOICE, DC_DATE, IN_DATE (the code aliases work even without this).
- Click Refresh Data in MRB Inward Materials so existing lots pick up the new values.
