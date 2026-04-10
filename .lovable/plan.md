

## Fix: Email Notifications Not Sent & Template Simplification

### Root Cause
The `send-mrb-email` edge function exists and works, but **it is never called from the frontend**. The `createMRB()` and `updateMRBStatus()` functions in `useMRBDatabase.ts` insert/update records and log approval history, but never invoke the email function.

### User Requirements
1. **Emails must actually be sent** when MRB events occur (created, forwarded, approved, rejected)
2. **Only send when the template's role matches a role in the MRB's `workflow_routing`** — if the role configured in the template is not part of the MRB's routing, skip sending
3. **Remove `cc_roles`** from the template UI — keep only one "Role" field (currently `to_roles`). Emails go to configured `to_emails` and `cc_emails` addresses when the selected role is present in the MRB workflow routing
4. **Support multiple comma-separated emails** in To and CC fields

### Changes

**1. `src/hooks/useMRBDatabase.ts`** — Add email trigger calls
- After `createMRB` succeeds (line ~128), call `supabase.functions.invoke('send-mrb-email', { body: { mrb_id, event_type: 'mrb_created', triggered_by: user.id } })`
- After `updateMRBStatus` succeeds (line ~258), determine the event type from the action (`approved` → `mrb_approved`, `rejected` → `mrb_rejected`, else `mrb_forwarded`) and invoke the email function
- These calls are fire-and-forget (no await blocking the main flow)

**2. `supabase/functions/send-mrb-email/index.ts`** — Update recipient logic
- Remove `ccRoles` resolution entirely
- For `toRoles`: only resolve role emails if that role exists in the MRB's `workflow_routing` array
- Keep `to_emails` and `cc_emails` from template as direct recipients (these are the comma-separated configured addresses)
- This ensures: email is only sent when the template's role matches a role in the MRB workflow

**3. `src/pages/EmailConfiguration.tsx`** — Simplify template UI
- Remove the "CC Roles" badge selector section (lines 648-662)
- Rename "To Roles" label to just "Role" — this is the workflow role that triggers the email
- Keep "To Emails" and "CC Emails" input fields as-is (comma-separated)

**4. `email_templates` table** — No schema change needed; `cc_roles` column stays but will be ignored by the edge function

### Flow After Fix
1. User creates MRB with workflow routing `[purchase, engineering, plant_head]`
2. `createMRB()` calls `send-mrb-email` with `event_type: 'mrb_created'`
3. Edge function fetches template for `mrb_created` event
4. Template has `to_roles: ['quality']` — checks if `quality` is in MRB's workflow_routing → it's NOT → skips role-based emails but still sends to `to_emails`/`cc_emails` if configured
5. When MRB is forwarded, `event_type: 'mrb_forwarded'` triggers — template with `to_roles: ['purchase']` checks workflow_routing → `purchase` IS present → resolves purchase users' emails and adds them to recipients along with `to_emails`/`cc_emails`

### Files Modified
1. `src/hooks/useMRBDatabase.ts` — trigger email on create/forward/approve/reject
2. `supabase/functions/send-mrb-email/index.ts` — filter roles by workflow_routing, remove cc_roles
3. `src/pages/EmailConfiguration.tsx` — remove CC Roles UI, rename To Roles to Role

