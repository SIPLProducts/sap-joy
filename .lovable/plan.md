

## Fix: Email Sending Fails — Switch to nodemailer & Handle All Email Formats

### Root Cause
From the edge function logs:
1. **`denomailer` rejects comma-joined emails** — it treats `"a@x.com, b@x.com"` as a single invalid address, causing `"No valid emails provided!"` and then an `"invalid cmd"` crash.
2. **No email validation** — invalid addresses crash the entire send instead of being skipped.

The working `test-smtp` function uses `nodemailer` successfully. `send-mrb-email` must switch to the same library.

### Changes — single file: `supabase/functions/send-mrb-email/index.ts`

1. **Replace `denomailer` with `nodemailer`** (`npm:nodemailer@6.9.10`) — matching the proven `test-smtp` pattern
2. **Normalize email arrays** — the `to_emails`/`cc_emails` from the database are stored as text arrays, but entries may contain commas (e.g. `["a@x.com, b@x.com"]`). Split every entry by comma, trim whitespace, then flatten into a clean array. Also handle the single-email case (no comma).
3. **Add email validation** — simple regex filter; skip invalid addresses with a console warning instead of crashing
4. **Use `nodemailer.createTransport()`** with TLS handling matching `test-smtp`:
   - `secure: port === 465`
   - `tls: { rejectUnauthorized: false }`
5. **Pass recipients as arrays** to `transporter.sendMail({ to, cc })` — nodemailer handles arrays natively
6. **If all emails invalid after filtering**, log as "skipped" instead of crashing

### Technical Detail

```
// Normalize: ["a@x.com, b@x.com", "c@x.com"] → ["a@x.com", "b@x.com", "c@x.com"]
const normalizeEmails = (arr: string[]) =>
  arr.flatMap(e => e.split(',')).map(e => e.trim()).filter(Boolean);

const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
```

### Files Modified
1. `supabase/functions/send-mrb-email/index.ts` — rewrite SMTP section to use nodemailer, add email normalization and validation

