## Goal
Add a confirmation step before deleting an SMTP configuration on the Email Configuration screen, and show a clear success toast after deletion.

## Changes (single file: `src/pages/EmailConfiguration.tsx`)

1. **Import AlertDialog primitives** from `@/components/ui/alert-dialog` (project standard for destructive confirmations per memory rule).

2. **Add state** `smtpDeleteTarget: SmtpConfig | null` to track which SMTP row is pending deletion.

3. **Replace the trash icon's direct call** (line 417) `onClick={() => deleteSmtp(smtp.id)}` with `onClick={() => setSmtpDeleteTarget(smtp)}` so it opens the confirmation dialog instead of deleting immediately.

4. **Refactor `deleteSmtp`** to accept the full config (or use the target from state), perform the delete, and on success show:
   - `toast({ title: 'Deleted', description: 'SMTP configuration for <plant/sender> removed successfully' })` (success variant style).
   - On error, show a destructive toast with the error message (currently silent on error).

5. **Render `<AlertDialog>`** at the bottom of the component, controlled by `smtpDeleteTarget`:
   - Title: "Delete SMTP Configuration"
   - Description: "Are you sure you want to delete the SMTP configuration for <sender_email> (plant <plant or 'All Plants'>)? This action cannot be undone."
   - Cancel button + Delete action button styled with `bg-destructive text-destructive-foreground`.

## Out of scope
- Email template deletion (line 469) — user only mentioned SMTP. Will leave unchanged unless requested.
- No backend or schema changes.
