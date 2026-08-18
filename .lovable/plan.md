# MRB Print — Replace X with tick mark in Material/Product Disposition

## Goal
In the MRB Print screen, after the PDF form is rendered, the selected option under **Material/Product Disposition** currently shows an "X" mark inside the checkbox. Change this to a proper tick mark (✓) without changing any data logic, decision mapping, or workflow behaviour.

## Current State
- `src/pages/MRBPrint.tsx` defines a shared `FORM_STYLESHEET` used for on-screen preview, browser print, and `html2pdf` export.
- The disposition checkboxes are rendered with CSS class `disp-box` and receive `checked` class when the MRB decision matches a disposition.
- The checked state is drawn via the pseudo-element `.disp-box.checked::after { content: "✗"; ... }` (lines 175–183).
- This applies to both:
  - Inward NCR (IQC) — page 2, **Material/Product Disposition** grid
  - Shop Floor NCR — page 1, **Material/Product Disposition** grid

## Change
Update the CSS pseudo-element in `FORM_STYLESHEET` only:
- Replace the content character from `"✗"` to `"✓"`.
- Slightly adjust positioning/sizing so the tick sits cleanly inside the 11 pt box, and remains visible in both print and PDF export (`html2pdf.js`).

No other code, logic, or functionality will be touched.

## Files to Modify
- `src/pages/MRBPrint.tsx` (lines 175–183 of the stylesheet).

## Verification
- Build the project successfully.
- Open the MRB Print preview for an MRB with a final decision mapped to a disposition (e.g., Scrap, Rework, Use as Is, etc.).
- Confirm the selected option now shows a ✓ instead of an X.
- Confirm the tick still renders correctly in PDF download and browser print.
