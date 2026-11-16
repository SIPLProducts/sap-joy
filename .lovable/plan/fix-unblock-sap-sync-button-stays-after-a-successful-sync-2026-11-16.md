# Fix: "Unblock & SAP Sync" button stays after a successful sync

## Goal
After SAP confirms the unblock, the MRB row must immediately show "SAP Synced" and the button must disappear, for every role allowed to unblock (including Quality Head). No other logic changes.

## Changes (minimal, additive only)

1. **Backend sync step (sap-sync)**
   - After SAP confirms success, also save the closing details on the MRB in the same server-side update: synced status, closure completed, closed date and closed-by user. For "Accept under deviation" it also sets status approved and clears pending department (already partly done).
   - Return a flag `db_finalized: true` in the response when this save worked.
   - Redeploy the sap-sync function.

2. **Worklist screen**
   - If the backend reports `db_finalized`, treat the record as finished even if the browser's own save is refused by access rules (today this throws "status update failed" and leaves the button).
   - Immediately mark the row as synced on screen, then reload the list so the green "SAP Synced" badge shows without a manual refresh.

3. **Database access rule (only if still needed)**
   - Confirm the existing rule lets Quality / Quality Head / Admin update accepted-deviation MRBs; add it only if missing. No existing rule removed.

## Not changed
SAP request payload, eligibility rules, Quality Head options, Stores flow, print form.

## Deployment note
QLTY/PRD need the updated sap-sync function and frontend rebuild.
