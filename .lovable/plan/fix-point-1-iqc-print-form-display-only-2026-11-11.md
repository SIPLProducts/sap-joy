# Fix Point 1 – IQC Print Form (display only)

Only the NCR print page is changed. No changes to MRB creation, workflow, SAP sync, or saved data.

## What will change on the print form

1. **Received QTY** – show total quantity; if it is 0/empty, show the blocked quantity.
2. **Rejected QTY** – if saved rejected qty is 0, show final rejected qty, else blocked qty.
3. **Accepted QTY** – if saved accepted qty is 0, show final approved qty, else Received minus Rejected (never below 0).
4. **GRN Date** – if empty, fall back to posting date, then inspection date.
5. **DC/INV No** – fill from DC/invoice no. (when SAP sends it) or Stores DC No; else "—".
6. **DC/INV Date** – fill from DC/invoice date (when SAP sends it), else GRN date; else "—".
7. **PO No. & Date** – show "PO No & PO Date" when PO date is available, otherwise PO No only.
8. **Initiator Name** – show the creator's full name (from the MRB creation history) instead of the login ID; existing fallbacks kept.

Fields that depend on SAP (DC/INV No, real invoice date, PO date) will fill automatically once the SAP team adds XBLNR / BLDAT / BEDAT to the ZMRB_Inward_Inspection response.

## Technical details
- File: `src/pages/MRBPrint.tsx` only (lines ~595-615 and ~881-908, plus initiator at ~994).
- Use a small `pos(n)` helper: treats 0/null as missing so fallbacks trigger.
- Reads optional fields defensively (`m?.delivery_challan_no`, `m?.stores_dc_no`, `m?.dc_invoice_date`, `m?.po_date`, `m?.posting_date`, `m?.inspection_date`); missing columns just render "—".
- Initiator name taken from the existing approval history entry with stage "Creation" (performer name), falling back to current values.
- No database migration, no edge function change.
