# Email Alert Recipients: document emails + manual email entry

## What changes for users
On the MRB create screens, inside each department card of the "Email Alert Recipients" box:
- Only the official HBL email IDs from the document are shown, each with a checkbox. Other app users are no longer listed there.
- Below the checkboxes there is a small box "Add other email" with an Add button. The initiator can type any email, press Add or Enter, and it shows as a small tag with an X to remove it.
- Wrong email formats are not accepted, and a message is shown. The same email cannot be added twice.
- Ticked emails and typed emails are saved together and get the alerts.
- If nothing is ticked or typed for a department, alerts go out as they do today.

## What stays the same
Saving MRBs, email sending, templates, workflow, reminders and approvals don't change.

## Technical details
- Only `src/components/mrb/AlertRecipientPicker.tsx` changes.
- The list for each department comes only from `getHblContactsFor(role, label)`. The user_roles/profiles lookup is no longer used for the list.
- A per-department text input checks the email with a regex. A valid email is appended to `value[role]` as `{ user_id: null, email }` through the existing `onChange`.
- Typed emails that are not in the document list are shown as removable tags.
- No database or edge function changes: the existing `mrb_alert_recipients` insert already saves the emails.
