

## UI/UX Improvement Plan: Responsive Layout, Scrolling, Font, and Email HTML

### Problem
1. Pages like User Management, SAP API Settings, SAP Sync Monitor, and Email Configuration lack proper padding/scroll containers — they appear "stuck" to the sidebar edge.
2. No responsive font scaling or consistent typography system.
3. Email notifications are sent as plain text (`text: body`) instead of styled HTML.
4. Dialog modals (Create/Edit User, SMTP config, Email Template) lack internal scroll for small screens.

### Changes

**1. Global Layout Fix — `AppLayout.tsx`**
- Add proper padding to `<main>` so content doesn't hug the sidebar: `p-4 md:p-6 overflow-y-auto`

**2. Page-level scroll & padding fixes** (4 files)
- `EmailConfiguration.tsx` (line 358-359): Wrap in `overflow-y-auto h-full p-4 md:p-6` container
- `SAPApiSettings.tsx` (lines 150, 160-161): Add `p-4 md:p-6` padding to root container
- `SAPSyncMonitor.tsx` (line 214): Add `p-4 md:p-6` padding
- `UserManagement.tsx` (line 410): Already has `container mx-auto p-6` — good, but adjust for consistency

**3. Responsive font sizing — `index.css`**
- Add responsive base font-size using `clamp()` on `html` element
- Scale headings with `text-lg md:text-2xl` pattern across all 4 pages
- Ensure tables use `text-xs md:text-sm` for readability on smaller screens

**4. Dialog scroll fixes**
- All `DialogContent` in User Management, Email Config: add `max-h-[85vh] overflow-y-auto`
- Email Template dialog already has this — verify consistency

**5. Table responsiveness**
- Wrap all `<Table>` sections in `overflow-x-auto` containers where not already present (SMTP table, Templates table in EmailConfiguration)

**6. HTML Email Templates — `send-mrb-email/index.ts`**
- Replace `text: body` with `html: generateHtmlEmail(subject, body)` 
- Add a `generateHtmlEmail()` function that wraps the template body in a styled HTML layout with:
  - HBL branding header (blue bar with company name)
  - Proper paragraph formatting (convert newlines to `<br>` and sections to styled blocks)
  - Footer with "This is an automated email from HBL MRB System"
  - Responsive email CSS (inline styles for email client compatibility)

### Files to modify
1. `src/components/layout/AppLayout.tsx` — main content padding + scroll
2. `src/pages/UserManagement.tsx` — responsive fonts, dialog scroll
3. `src/pages/SAPApiSettings.tsx` — padding, responsive fonts
4. `src/pages/SAPSyncMonitor.tsx` — padding, responsive fonts  
5. `src/pages/EmailConfiguration.tsx` — padding, scroll, responsive fonts, dialog scroll
6. `src/index.css` — responsive base font, clamp sizing
7. `supabase/functions/send-mrb-email/index.ts` — HTML email template

### No database or migration changes needed.

