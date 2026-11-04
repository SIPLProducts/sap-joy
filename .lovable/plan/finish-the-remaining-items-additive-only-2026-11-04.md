# Finish the remaining items (additive only)

1. Fix the old MRB detail screen error: define the missing "has workflow routing" check so old approve/reject buttons hide only on MRBs with a workflow routing.
2. After a successful SAP unblock (Worklist and sap-sync function), also clear the "pending with" department; status stays approved. Redeploy sap-sync.
3. On-premise schedule script: add the daily 03:30 UTC call to the pending-reminders function.
4. On-premise edge function deploy script: copy the shared code folder and skip it as a standalone function.
5. Check the build log and confirm the preview loads.

## Technical notes
- MRBDetail.tsx: add `const hasRouting = Array.isArray(mrb.workflow_routing) && mrb.workflow_routing.length > 0;` after the `if (!mrb)` guard.
- Worklist.tsx / sap-sync handler: add `pending_with: null` only in the success update for accept_under_deviation.
- deploy/setup-scheduler.sh, deploy/deploy-edge-functions.sh.
