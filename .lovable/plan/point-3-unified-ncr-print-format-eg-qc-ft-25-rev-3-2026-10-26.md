# Point 3: Unified NCR Print Format (EG-QC-FT-25 REV 3)

## Goal
On the MRB Print screen, add the new 2-page unified "NON-CONFORMANCE REPORT" (EG-QC-FT-25 REV 3), filled from the existing MRB details. The current IQC and Shop Floor print formats stay exactly as they are.

## What the user will see
- A new "Format" choice on the MRB Print screen: **Existing format** (default, unchanged) or **Unified NCR (Rev 3)**.
- Preview, Print and PDF buttons work the same for both formats.

## Rev 3 layout (filled from existing data)
Page 1
- Header: plant company name, "Electronics Group", "NON-CONFORMANCE REPORT".
- Two-column details: GRN No / NC Report No (MRB number), GRN Date / NC Report Date (created date), DC/INV No / WO No (production order), DC/INV Date / WO Date, Vendor Code / PO No. & Date, Vendor Name / Item Code (material number), Item Description.
- Received QTY (total), Accepted QTY, Rejected QTY.
- Rejected QTY Sl Nos (batch).
- Non-Conformance details (defect / issue description) + Initiator Name.
- Process QC Comments (quality remarks) + Name.
- MRB Review table: Purchase, Engineering, Production, Quality Control with each department's review comments from the workflow history (excluding creation comments).
- Footer: "EG-QC-FT-25 REV 3" and "Page 1 of 2".

Page 2
- Material / Product disposition with tick boxes: Accept under deviation, Return to supplier, Rework, Sort, Scrap, Others (same tick logic as today).
- MRB Approvals table: Department, Name, Sign (blank), Date per department.
- Disposition of Non-Confirming Material (by STORES): closure remarks / SAP document numbers if present.
- NCR Status: OPEN / CLOSED ticked from the MRB status.
- Footer: "EG-QC-FT-25 REV 3" and "Page 2 of 2".

Fields with no stored value (DC/INV No and Date, WO Date, PO Date) print blank.

## Technical notes
- File: `src/pages/MRBPrint.tsx` only. Add a new `UnifiedNCRReport` component and a format state; render it instead of the existing report only when Rev 3 is selected. Existing `InwardNCRReport`, `ShopFloorNCRReport`, stylesheet rules, data fetching and print/PDF handlers are untouched.
- New CSS classes are appended to `FORM_STYLESHEET` with a `ncr3-` prefix so existing styles are unaffected.
- Department comments are grouped from the already-loaded `mrbComments` by `stage`; names from the existing `approverNames` lookup.
- No database, workflow or SAP changes.
