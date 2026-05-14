# Fix: Master Admin auto-logout on sign-in

## Root cause
`profiles.masteradmin@sharviinfotech.com` has `user_security.last_password_change = 2026-03-30` and `password_expiry_days = 45`. As of today that evaluates to **exactly 45 days → `password_expired = true`**.

In `src/pages/Login.tsx` (lines 122–131), right after a successful `signIn`, the app calls `check_login_security`. When `password_expired` is true it:
1. Shows "Your password has expired. Please contact your administrator to reset it."
2. Calls `supabase.auth.signOut()` and clears storage.
3. Returns before navigation.

This matches the auth logs showing rapid login → logout cycles for `masteradmin@sharviinfotech.com`. Since masteradmin **is** the administrator, there is no one to "contact", so they're permanently locked out by their own policy.

## Fix
Exempt the master admin account from the expiry-forced logout, and refresh its password timestamp so the warning stops recurring.

### 1. `src/pages/Login.tsx`
Skip the expiry-forced sign-out when the resolved login email is `masteradmin@sharviinfotech.com`:

```ts
if (loginEmail.toLowerCase() !== 'masteradmin@sharviinfotech.com'
    && secData?.password_expired) {
  // existing expired branch (signOut + error + return)
}
```

Master admin still gets `reset_failed_login` and proceeds to navigate normally.

### 2. Refresh masteradmin's `last_password_change` (one-off migration)
Update the existing row so the expiry resets immediately for the current production account:

```sql
UPDATE public.user_security
SET last_password_change = now(), updated_at = now()
WHERE user_id = (
  SELECT user_id FROM public.profiles
  WHERE email = 'masteradmin@sharviinfotech.com'
);
```

## Out of scope
- Changing the global 45-day policy or password complexity rules.
- Changing behavior for any other role (superadmin, admin, etc.) — they still see the expiry message and must have their password reset by master admin.
- UI changes on the Login screen.

## Verification
- Sign in as masteradmin → lands on dashboard, no immediate logout.
- Sign in as a normal user with an expired password → still sees the expiry message and is signed out (unchanged).
