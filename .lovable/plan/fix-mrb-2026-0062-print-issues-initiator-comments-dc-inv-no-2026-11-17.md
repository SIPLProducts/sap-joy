# Fix MRB-2026-0062 print issues (initiator comments + DC/INV No)

Only the two lines/blocks below change. No other logic is touched.

## 1. Non-Conformance details: show only initiator name and comments
In the IQC print form:
- Initiator comment reads only what the initiator entered at creation (defect description, issue description, or the creation remark in history). Quality Head remarks are no longer used here.
- Initiator name comes from the person who created the MRB (their profile name), then "issue identified by". It no longer falls back to the Quality Head's name.

## 2. DC/INV No, DC/INV Date, PO Date saved on Inward "Refresh Data"
- The Refresh Data function now keeps the three new fields (DC/INV No, DC/INV Date, PO Date) and SAP's names for them (DCNUMBER / INVOICE, DC_DATE / IN_DATE, BEDAT) instead of dropping them.
- After deploy, click Refresh Data in MRB Inward Materials so lot 10000773978 and others get the values. If SAP returns them blank for a lot, the print will stay blank for that lot.

## Technical details
- `src/pages/MRBPrint.tsx`: remove `quality_remarks` from `initComment`; resolve `created_by` via `profiles` for `initiatorName`; drop `approverNames.quality` fallback.
- `supabase/functions/sap-sync/handler.ts`: add `po_date`, `dc_invoice_no`, `dc_invoice_date` to `allowedColumnsByTable.inward_inspection_lots` and the alias map (`bedat`, `dcnumber`, `invoice`, `dc_date`, `in_date`); redeploy `sap-sync`.
- QLTY/PRD: pull, rebuild, redeploy `sap-sync`.
