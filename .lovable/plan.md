# Manual emails: checkbox + X to remove

## What changes for users
In each department card of "Email Alert Recipients":
- A typed email is added to the list with its own checkbox, ticked from the start.
- The user can untick it and tick it again without typing it again. Unticked emails stay on screen but get no alerts.
- Each typed email has a small X next to it that removes it from the list.
- The HBL document emails stay as they are, with a checkbox and no X.

## What stays the same
Email checks, the duplicate check, saving, email sending, workflow and approvals stay the same. Only ticked emails are saved and get alerts, as today.

## Technical details
- Only `src/components/mrb/AlertRecipientPicker.tsx` changes.
- New local state `manualList: Record<role, string[]>` keeps typed emails. Selection stays in `value[role]` through the existing `onChange`.
- `addManual` adds the email to `manualList[role]` and ticks it with `setChecked(role, email, true)`. The duplicate check also looks at `manualList`.
- Each manual row shows a Checkbox (`has` / `setChecked`), the email and an X button. The X removes the email from `manualList` and from `value[role]`.
- Typed emails already in `value` when the screen opens are added to the manual list, so none are lost.
