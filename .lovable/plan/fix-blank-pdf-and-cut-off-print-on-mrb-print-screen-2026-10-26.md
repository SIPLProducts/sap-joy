# Fix blank PDF and cut-off Print on MRB Print screen

## What is wrong (from your screenshots)
- **PDF**: downloads as 1 blank page.
- **Print**: the right side is cut off (HBL logo shows only "HB", tables run to the edge). The browser also adds its own date, title and "about:blank" text on the page edges.

## Fixes (only the Print and PDF buttons and the print page size; form content, data and logic unchanged)
1. **PDF**
   - Stop building the PDF from a hidden copy behind the page, which is why it comes out blank. Hand the complete form (styles and both pages) straight to the PDF tool, which renders it visibly in its own temporary layer, and wait for the logo to load first.
   - Use the same page size and margins as Print, so the file is exactly 2 A4 pages.
2. **Print**
   - Fix the print page so the form is exactly A4 width (210mm with fixed margins) and doesn't stretch past the right edge. The logo and every table column then fit inside the page.
   - Set the page margins in the print window so the browser's date, title and "about:blank" text don't appear.
   - Keep the single-print, stay-open behaviour from the last fix.

## Verify (before reporting back)
- Load real MRB `MRB-2026-0039` in a test browser and click PDF. Open the downloaded file and check it has 2 filled pages, the full logo, and nothing cut off.
- Save the Print window output as PDF and check both pages: right edge intact, no browser header or footer text.
- If the test browser still shows a blank app screen, first fix how it signs in and opens the page, so the check runs on the real screen.

## Technical notes
- File: `src/pages/MRBPrint.tsx` only: `handlePrint`, `handleDownloadPDF`, `buildStandaloneHTML`, plus print-only rules in `FORM_STYLESHEET` (`@page { size: A4; margin: 0 }`, `.mrb-preview-wrap` padding 12mm/14mm and width 210mm in print, `.mrb-form` max-width 182mm).
- PDF: `html2pdf().from(fullHtmlString, 'string')` or a visible overlay container at `left:0; top:0` with `opacity` intact (no negative z-index, which is what html2canvas renders as blank). `margin: 0`, padding comes from the wrapper, `pagebreak: { mode: ['css'] }`, `html2canvas.windowWidth` set to the A4 pixel width.
- Verification uses Playwright `expect_download` and `pdftoppm` on the saved file, plus `page.pdf()` on the standalone print HTML.
