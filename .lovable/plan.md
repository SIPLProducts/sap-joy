

## Fix: Invalid Login Credentials After User Creation/Password Reset

### Root Cause
The `admin_update_user_password` database function uses `gen_salt('bf')` which generates a bcrypt hash with cost factor 6 (`$2a$06$`). However, Supabase's GoTrue auth service expects cost factor 10 (`$2a$10$`). When a password is reset via the admin function, the hash is stored with the wrong cost factor and GoTrue rejects it during login.

Evidence from the database:
- Users created via GoTrue signUp: `$2a$10$...` ✓ (login works)
- Users whose password was reset via RPC: `$2a$06$...` ✗ (login fails)

### Changes

**1. Database migration — Fix `admin_update_user_password` function**
- Change `gen_salt('bf')` to `gen_salt('bf', 10)` to match GoTrue's expected bcrypt cost factor
- This is a one-line fix in the existing function

```sql
-- Before:
extensions.crypt(new_password, extensions.gen_salt('bf'))

-- After:
extensions.crypt(new_password, extensions.gen_salt('bf', 10))
```

**2. Fix any existing broken passwords**
- The migration will also re-hash any `$2a$06$` passwords that are currently in the system by detecting them — but since we don't know the plaintext, we can't fix existing broken hashes automatically
- Users with broken hashes will need their password reset again (once) after this fix

### Files Modified
1. New database migration (fix `gen_salt` cost factor)

### After Fix
- Admin password resets will produce `$2a$10$` hashes matching GoTrue's expectations
- Any previously broken users will need one more password reset from admin

