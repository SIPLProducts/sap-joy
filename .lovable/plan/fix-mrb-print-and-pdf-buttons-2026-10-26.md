# Fix MRB Print and PDF buttons

## Goal
Make the Print and PDF buttons on the MRB Print screen reliably produce the full 2-page Rev 3 form. Only the two button actions change; the form, data and everything else stay as they are.

## Fixes
1. **Print**
   - Print only once (today it can fire twice: once on load and once again after 1.2s).
   - Don't close the print window automatically; it closes after the user prints or cancels. This stops some browsers from closing it before the print dialog opens.
   - Wait for the HBL logo image to load before printing so it isn't missing.
2. **PDF**
   - Render the temporary copy inside the screen area, hidden behind the page, instead of 10000px off-screen. This stops blank or cut-off pages.
   - Wait for the logo image to load before capturing.
   - Use margins that fit the fixed A4 page height so the form stays exactly 2 pages with no extra blank page.

## Verify
- Load a real MRB in the browser, click PDF, check the downloaded file has 2 filled pages that match the form.
- Click Print, confirm the print window opens once with both pages and stays open.

## Technical notes
- File: `src/pages/MRBPrint.tsx`, only `handlePrint` and `handleDownloadPDF`.
- Print: single `onload` path with a guard flag, `afterprint` closes the window, waits for `img.complete`.
- PDF: container `position:fixed; left:0; top:0; z-index:-9999; width:210mm`, await image decode, margin `[0,0,0,0]` or small values consistent with the 270mm page height, `pagebreak: { mode: ['css'] }`.
