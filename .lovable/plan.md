

## Add "Test Email" Button to SMTP Configurations

### Overview
Add a "Test" button next to each SMTP config row. When clicked, it opens a small dialog asking for a recipient email address, then sends a test email using that SMTP config via a new edge function.

### Changes

**1. New Edge Function: `supabase/functions/test-smtp/index.ts`**
- Accepts `smtp_config_id` and `to_email` in the request body
- Fetches the SMTP config from `smtp_config` table by ID
- Sends a simple test email ("SMTP Test from [Plant] - Configuration Verified") to the provided address using `denomailer`
- Returns success/failure with error details

**2. Update `src/pages/EmailConfiguration.tsx`**
- Add state for test dialog: `testSmtpId`, `testEmail`, `testDialogOpen`, `testSending`
- Add a `Send Test` icon button (Mail icon) in the SMTP table actions column next to Edit/Delete
- When clicked, opens a dialog with an email input field and "Send Test" button
- On submit, calls the `test-smtp` edge function and shows success/error toast
- Add the dialog markup near existing dialogs

### Files Created/Modified
- `supabase/functions/test-smtp/index.ts` (new)
- `src/pages/EmailConfiguration.tsx` (add test button + dialog)

