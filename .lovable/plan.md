# Implement approved MRB changes (with corrections)

Only the changes below. Existing logic stays as it is: the 6 Quality Head options, SAP 343 unblock and MB52 checks, mandatory comments for other departments, and the print layout (apart from the NCR Status rule).

## 1. Quality Head + Stores in every workflow
- Workflow Routing Configuration: Quality Head and Stores are always on, Quality Head is always second to last and Stores is always last. Their reorder buttons are locked, and the save checks this too. A warning appears if either department is missing, inactive or not set up for workflows.
- All 3 creation screens send the routing through `buildManualRouting` before saving. MRB creation is blocked with a clear message if Quality Head or Stores is missing.
- Batch create (Inward and In-Process): each MRB is saved with the plant's routing, normalised the same way, and pending_with/status come from the first step. A plant with no predefined workflow has only its own lots skipped, with the message "No predefined workflow for plant X. Please create this MRB individually." The other lots are still created.
- EmailLog and dashboard links go to the same detail pages as the Worklist. The old Approve, Final Approve and Reject buttons in MRBDetail are hidden when the MRB has workflow_routing.

## 2. Accept under deviation
- When Quality Head submits it: status becomes approved, pending_with becomes null, final_decision is accept_under_deviation, and Stores gets the existing email as information only.
- Stores read-only view is based on final_decision (shown even after approval). It shows the note "Quality Head accepted this material. Review only." and hides Action, Comments and Submit. These MRBs show up in the Stores user's Worklist.
- `handleSAPSync` and `handleBatchSync`: a successful sync on an accept_under_deviation MRB also sets status to approved and pending_with to null. The SAP 343 call is not changed.

## 3. Sync button and NCR Status
- `canUnblockSAP` gets quality_head added. The sap-sync access error message now names Quality Head.
- NCR Status: for accept_under_deviation, it shows CLOSED only once the SAP stock status is synced, otherwise OPEN. The other options keep their current logic, applied in every print format that shows NCR Status.

## 4. Stores fields for non-accept decisions
- In both detail screens, Stores Remarks is replaced by DC No, Debit Note No and Reference No. At least one is required ("Enter DC No, Debit Note No or Reference No"). Review Comments becomes optional and the BLOCKED notice stays.
- Only filled fields are saved, e.g. "DC No: 123 | Reference No: 789", followed by the comments if any. This text shows in review history and in the STORES box on the print form.

## 5. Email alerts
- The recipient picker is added to Shop Floor creation and its selections are passed to createMRB.
- On the Shop Floor success screen, "Email notification: Sent" becomes "Queued".
- mrb-pending-reminders is scheduled daily in the cloud and also added to `deploy/setup-scheduler.sh`.

## 6. Self-hosted deployment
- `deploy-edge-functions.sh` copies `_shared` (it is not treated as a function).
- A new IF NOT EXISTS migration for mrb_alert_recipients is added. Existing data is untouched.
- package-lock.json is updated with html2canvas-pro.

## Verification
Check routing order, batch routing saved (including the mixed-plant batch), Accept under deviation flow (sync right away, Stores read-only, no longer pending after sync), the non-accept 3-field rule, Quality Head can see and run Sync, and NCR Status for each option.
