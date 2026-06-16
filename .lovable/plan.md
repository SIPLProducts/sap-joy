## Problem

After entering correct credentials, the user is signed in for a split second and bounced back to `/login` with no visible reason. The 45‑day expiry check in `src/pages/Login.tsx` is firing, signing them out, and only setting a small inline error that is easy to miss — so it looks like a silent redirect loop.

## Fix

Make the expiry case unmistakable and stop it from looking like a bounce.

1. **Check expiry BEFORE the app navigates in** (in `src/pages/Login.tsx`, around lines 115–142):
   - Run `check_login_security` immediately after a successful `signIn`.
   - If `password_expired` is true and the user is not master admin:
     - Call `supabase.auth.signOut()` + `clearAuthStorage()` (already done).
     - Open a blocking `AlertDialog` titled **"Password Expired"** with body: *"Your password has expired as per the 45‑day security policy. Please contact your administrator to reset it before signing in again."*
     - Single **OK** button that closes the dialog and keeps the user on `/login`.
     - Also set a persistent inline red banner above the form: *"Password expired — contact your administrator."*
   - Only call `navigate(from)` when expiry check passes. This guarantees no flash into the app.

2. **No DB / RPC changes** — `check_login_security` already returns `password_expired` based on the 45‑day rule.

3. **Master admin** continues to bypass the check.

## Technical details

- Add state: `const [passwordExpiredOpen, setPasswordExpiredOpen] = useState(false)`.
- Import `AlertDialog`, `AlertDialogContent`, `AlertDialogHeader`, `AlertDialogTitle`, `AlertDialogDescription`, `AlertDialogFooter`, `AlertDialogAction` from `@/components/ui/alert-dialog`.
- Replace the current expiry block (lines ~122–132) so it sets both `loginError` and `passwordExpiredOpen(true)` before returning.
- Render the `<AlertDialog open={passwordExpiredOpen} onOpenChange={setPasswordExpiredOpen}>` near the bottom of the component JSX.
- Keep `setIsLoading(false)` and the early `return` so `navigate()` never runs for expired users.

## Out of scope

- Self‑service password reset email flow (project policy is admin‑driven).
- Changing the 45‑day window.