# Email Alerts: initiator picks who gets notified per department

## What changes for users
- On the MRB create screens (Inward, In-Process, Shop Floor), after the workflow departments are shown, a new optional section "Email Alert Recipients" appears.
- For each department in the MRB's workflow, the initiator can pick one or more people (list shows only active users of that role and plant, with name + email).
- When an alert fires for that MRB, emails go only to the chosen people for the relevant departments.
- If nobody is chosen for a department, today's behaviour stays exactly as is (everyone in that role for the plant + template To/CC lists).
- MRB detail page shows the chosen recipients (read-only).

## What stays the same
- Existing templates, To/CC lists, SMTP, workflow routing, approvals and email log are untouched.
- Existing MRBs (no selection saved) keep sending alerts as today.

## Technical details
- New table `mrb_alert_recipients` (mrb_id, role_key, user_id, email, created_at) with grants + RLS (authenticated read/insert; service_role all).
- New small component `AlertRecipientPicker` used in the three create pages; saves rows after the MRB insert succeeds (additive call, no change to existing insert logic).
- `send-mrb-email`: in the role-resolution block, if `mrb_alert_recipients` has rows for a matching role, use those emails for that role instead of the broad role lookup; otherwise fall back to current code path.
- On-prem: add the table SQL to `deploy/fix-scripts.sh` and redeploy the `send-mrb-email` function.
