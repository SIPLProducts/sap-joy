# Remove the "Accept" option

- Remove "Accept" from the Quality Head Action dropdown (Shop Floor and Inward review screens). The 6 original options stay.
- Unblock & SAP Sync stays enabled for "Accept under deviation" (and older MRBs, as before).
- Stores view-only note stays for "Accept under deviation".

## Technical details
- `ShopFloorMRBDetail.tsx`, `InwardMRBDetail.tsx`: remove `'accept'` from `QH_ACTIONS` and the `<SelectItem value="accept">`. Keep the `'accept'` label mapping and checks (harmless, supports any old data).
- Worklist, print form and Stores-step preservation logic unchanged.
