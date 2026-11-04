# Apply 3 small refinements (no other changes)

1. **Unblock & SAP Sync closes the MRB right away (Point 7)**
   In the Worklist, after a successful unblock (single and batch), also save the MRB as approved and clear the department it is waiting with — the same fields already saved by the server. The MRB then shows as closed without reloading the page.

2. **Stores "view only" notice always visible (Point 8)**
   On the Shop Floor and Inward MRB detail screens, show the blue notice "Quality Head decision: Accept under deviation — review only, no dispatch details needed" at the top of the ticket, not only inside the review form, so Stores sees it whenever they open the ticket.

3. **Print form typo (Point 1)**
   "Return to spplier" becomes "Return to supplier".

Nothing else changes: dropdown options, routing, permissions and sync rules stay as they are.

## Technical details
- `Worklist.tsx` `handleSAPSync` / `handleBatchSync`: add `status: 'approved', pending_with: null` to the existing success update only when `finalDecision === 'accept_under_deviation'`.
- `ShopFloorMRBDetail.tsx`, `InwardMRBDetail.tsx`: render the existing banner outside the review form, conditioned on `final_decision === 'accept_under_deviation'`; remove the duplicate inside the form.
- `MRBPrint.tsx` ~line 947: label text fix only.
