# Exact Match: EG-QC-FT-25 REV 3 Print Form

## Goal
Make the MRB Print form look exactly like the uploaded PDF (NCR_QC_EG-QC-FT-25_Rev_3-2.pdf), page for page, while keeping all data, logic and buttons unchanged.

## What the user will see
- Page 1 and Page 2 laid out exactly like the PDF: HBL logo position, "HBL Engineering Limited / Electronics Group" header, title, two-column details with dotted lines, quantity rows, Rejected QTY Sl Nos, Non-Conformance box with Initiator Name, Process QC comments with Name, MRB Review table (Purchase, Engineering, Production, Quality Control).
- Page 2: disposition tick boxes, MRB Approvals table (Department / Name / Sign / Date), Disposition by STORES box, NCR Status OPEN/CLOSED, footers "EG-QC-FT-25 REV 3" and "Page X of 2".
- Always exactly 2 A4 pages; Page 2 always starts on a new sheet in Preview, Print and PDF.
- Same real MRB values as today; nothing hardcoded except fixed form labels.

## Steps
1. Render the uploaded PDF pages to images and measure margins, borders, column widths, row heights and font sizes.
2. Adjust only the Rev 3 form styling (the `ncr3-` rules) and its markup structure to match those measurements.
3. Load a real MRB, generate the PDF, and compare side-by-side with the uploaded PDF; repeat until they match.

## Technical notes
- File: `src/pages/MRBPrint.tsx` only — `UnifiedNCRReport` component and `ncr3-` CSS in `FORM_STYLESHEET`.
- Fixed A4 page size (210mm x 297mm) per page with `page-break-after` so long comments do not spill to a third page (text shrinks/clips inside its box).
- Data fetching, comment/approver lookups, tick logic, print/PDF handlers, old formats and all other screens untouched. No database or SAP changes.
