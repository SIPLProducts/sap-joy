# Point 10: Stores Remarks for Return to Supplier / Scrap / Rework / Sort / Others

## When it applies
Only when the MRB is with **Stores** and the Quality Head chose Return to supplier, Rework, Sort, Scrap or Others. Every other step (Quality Head, other departments, Stores after "Accept under deviation") stays exactly as it is today.

## What the Stores user will see
- The "Action" box is hidden.
- In its place: a new **Stores Remarks \*** box (mandatory), for DC No, Debit Note No, Reference No, etc.
- The red "Stock remains BLOCKED in SAP" notice and the Review Comments box stay as they are.
- Submit is blocked with a message "Stores Remarks are required" until it is filled.

## What happens on Submit
- Same flow as today: the review is saved as "forward" and the MRB closes as before.
- The Stores Remarks text is saved together with the Stores review comment (no database change), so it appears in review history and on the print form under "Disposition of Non-Confirming Material (by STORES)".

## Screens changed
- Shop Floor MRB review screen
- Inward / In-Process MRB review screen

## Technical details
- In `ShopFloorMRBDetail.tsx` and `InwardMRBDetail.tsx`: add `isStoresActionStep = mrb.pending_with === 'stores' && ['return_to_supplier','rework','sort','scrap','others'].includes(final_decision)`.
- Add `storesRemarks` local state; render a `Textarea` in place of the Action `Select` when `isStoresActionStep`.
- Validation in submit handler: if `isStoresActionStep && !storesRemarks.trim()` show toast and return.
- Comment saved = `"Stores Remarks: <remarks>"` joined with existing review comments; add "Stores Remarks" to the print `cleanComment` prefix list so the print shows clean text.
- Submit button disabled condition extended for this step only. No other logic touched.
