# Single Print Format: EG-QC-FT-25 REV 3 (exact match)

## Goal
Make the unified "NON-CONFORMANCE REPORT" (EG-QC-FT-25 REV 3) the only print format on the MRB Print screen for every MRB (Inward/IQC and Shop Floor/Process QC), with the layout matching the uploaded PDF exactly.

## What the user will see
- The "Format" dropdown is removed; every MRB prints in the Rev 3 layout.
- Preview, Print and PDF buttons work exactly as today.
- Page 1 and Page 2 match the uploaded PDF: HBL logo and "HBL Engineering Limited / Electronics Group" header, title, two-column detail grid, quantities, Rejected QTY Sl Nos, Non-Conformance details + Initiator, Process QC comments + Name, MRB Review table (Purchase, Engineering, Production, Quality Control), disposition tick boxes, MRB Approvals table (Department / Name / Sign / Date), Disposition by STORES box, NCR Status OPEN/CLOSED, footers "EG-QC-FT-25 REV 3" and "Page X of 2".
- All values come from the existing MRB details (synced from SAP plus workflow entries). Fields with no stored value print blank.

## Technical notes
- File: `src/pages/MRBPrint.tsx` only.
- Default and lock the format state to Rev 3 and hide the selector. The old `InwardNCRReport` / `ShopFloorNCRReport` components stay in the file untouched (just not rendered), so nothing is deleted.
- Refine the `ncr3-` CSS rules (borders, column widths, row heights, font sizes, A4 page break between pages) to match the PDF; existing stylesheet rules untouched.
- Data fetching, comment/approver lookups, tick logic, print and PDF handlers unchanged.
- Verify by rendering a real MRB to PDF and comparing side-by-side with the uploaded PDF.
- No database, workflow or SAP changes.
