# Point 2: Next Action Email Alert & Reminders

## What users will see
- **Next-action alert:** When an MRB is created or forwarded, the person(s) chosen for the department that now holds the MRB get a direct "Action required on MRB-xxxx" email. If nobody was chosen for that department, it goes to all users of that role in the plant (same fallback as Point 1).
- **Reminders:** If the MRB sits with the same department without action, the pending person gets a reminder email once per day (max 1 per MRB per day), with pending days shown in the email.
- **Email Configuration:** two new template types appear — "Next Action Alert" and "Pending Reminder" — editable like the existing ones. Reminders can be switched off by deactivating the template.
- All emails continue to appear in the Email Log.

## What stays the same
- Existing created / forwarded / approved / rejected emails, templates, recipients, workflow routing, approvals and SMTP are not changed. The new emails are sent in addition.

## Technical details
- New edge function `send-next-action-email` (mrb_id): reads `pending_with`, maps to role via departments, uses `mrb_alert_recipients` for that role or falls back to role+plant users; uses template `mrb_next_action` (built-in default text if none); logs to `email_logs`.
- `useMRBDatabase.ts`: add one extra fire-and-forget invoke after the existing email calls in `createMRB` and `updateMRBStatus` (only when MRB is still open). No existing lines modified.
- New edge function `mrb-pending-reminders`: finds open MRBs (not approved/rejected/closed) whose last history entry is older than 24h and no `mrb_reminder` email logged in last 24h; sends reminder with template `mrb_reminder`.
- Schedule: once daily at 09:00 IST (03:30 UTC) via pg_cron — 1 run per day, low cost.
- Seed the two default templates (inactive-safe, plant = null).
- On-prem: add function deploy entries + cron SQL to deploy scripts.
