
I inspected the current MRB print code and the uploaded templates. The main gap is that `MRBPrint.tsx` still renders approximate report layouts, while the uploaded PDFs are fixed-format regulated forms. Also, preview, browser print, and PDF are not guaranteed to match right now because they do not all use the same styling path.

## Plan

### 1. Rebuild the Inward print as the exact IQC template
Update `src/pages/MRBPrint.tsx` so `source === 'inward'` renders a true 2-page A4 portrait form matching `NON_Conformance_Report_IQC-2.pdf`:
- Header with logo + red rule
- Title: `NON-CONFORMANCE REPORT (IQC)`
- Exact page 1 structure:
  - GRN No / NC Report No
  - GRN Date / NC Report Date
  - DC / INV No / DC / INV Date
  - Supplier Name
  - PO No / Item Code
  - Item Desc. & Make
  - Received / Accepted / Rejected Qty
  - Large Non-Conformance Details box
  - Initiator Name / Sign
  - MRB Yes / No row
  - Detailed Instructions of MRB table
- Exact page 2 structure:
  - Material/Product Disposition checkbox layout
  - Material Review Board Approvals table with the same department rows as the PDF
  - NCR Status comments area
  - Open / Close boxes
  - Quality Control sign/date line
- Use the exact footer metadata from the uploaded template, including page numbering.

### 2. Rebuild the Shop Floor print as the exact EG-QC template
Update `src/pages/MRBPrint.tsx` so `source === 'shop_floor'` renders a true 1-page A4 portrait form matching `EG-QC-FT-502_Rev0_Non_conformity_Report-2.pdf`:
- Header with logo + red rule
- Title: `NON-CONFORMITY REPORT`
- Exact section layout:
  - INITIATOR grid
  - Initiator Name / Date row
  - Material / Product Description row
  - Deviation Summary box
  - MRB section
  - Material/Product Disposition block with matching checkbox placement/order
  - Justification for acceptance area
  - Material Review Board Approvals signature lines
  - Quality Assurance closure section
- Use the exact footer metadata from the uploaded template.

### 3. Apply the requested branding in the print forms
Replace template text in both print layouts with:
- `HBL Engineering Limited`
- `Rail Signaling Division`

To keep output consistent, these two regulated print layouts should use the required fixed labels directly instead of depending on old configurable plant header/footer values.

### 4. Make print, preview, and PDF render identically
The current implementation mixes Tailwind-rendered DOM with separately injected print CSS, which can cause alignment drift. I’ll fix that by:
- Converting the print templates to self-contained layout styling using fixed A4 dimensions and exact positioning/spacing
- Using the same template stylesheet for:
  - on-screen preview
  - browser print window
  - PDF export
- Preserving exact page breaks for the 2-page inward form

### 5. Lock the format to stable print settings
To keep the output identical to the uploaded documents:
- Force A4 portrait for both layouts
- Prevent layout-breaking overrides from printer settings on this screen
- Keep automatic format selection only by MRB type:
  - `inward` → IQC form
  - `shop_floor` → EG-QC form

### 6. Populate only real data, leave template blanks where needed
Some fields/signature areas in the PDFs do not exist exactly in `mrb_records`. I’ll map available MRB data into the matching template fields and leave the remaining handwritten/signature-style areas blank so the form still matches the source document exactly.

## Files to update
- `src/pages/MRBPrint.tsx`
- `src/components/print/PrintPreviewModal.tsx` (if needed so preview uses the same exact template stylesheet)

## Result
- Inward MRBs print as the exact 2-page IQC form
- Shop Floor MRBs print as the exact 1-page EG-QC form
- Branding shows `HBL Engineering Limited` and `Rail Signaling Division`
- Preview, printed output, and downloaded PDF remain visually consistent
