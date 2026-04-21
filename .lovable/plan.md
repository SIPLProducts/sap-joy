
## Fix Password Reset Confusion for Employee Login

### What is happening
The password policy is currently **8-10 characters only**.

`Kakinada@123` is **12 characters**, so it is not a valid password under the current rule.

However, the User Management password input currently does this:

```ts
e.target.value.slice(0, 10)
```

That means when an admin types:

```text
Kakinada@123
```

the app silently saves only:

```text
Kakinada@1
```

So when Chandra tries to login with `Kakinada@123`, the backend correctly returns:

```text
Invalid login credentials
```

Also, if Chandra logs in using employee ID `123456`, the app first resolves `123456` to Chandra’s email and then signs in with the password. The employee ID part is fine; the problem is the password reset UI silently trimming the password.

## Implementation Plan

### 1. Stop silently cutting passwords in User Management
Update `src/pages/UserManagement.tsx`.

Current behavior:
- Create User password field cuts input to 10 characters.
- Reset Password field cuts input to 10 characters.
- Admin may think a longer password was saved, but only the first 10 characters are stored.

New behavior:
- Remove `.slice(0, 10)`.
- Remove `maxLength={10}`.
- Allow the admin to type the full password.
- Show validation clearly if it is more than 10 characters.
- Do not save until the password satisfies the policy.

### 2. Validate password before saving any user changes
Currently, the edit flow updates profile, plant, and role before password reset validation is fully completed.

Change `handleSaveEdit()` so password validation happens at the beginning:
- If reset password is entered and invalid, stop immediately.
- Do not update role, employee ID, plant, or password.
- Show a clear error.

Example message:

```text
Password must not exceed 10 characters. Current length: 12.
```

This prevents partial user updates when password validation fails.

### 3. Add clear password length helper text
Update the Create User and Edit User dialogs to show:

```text
Password must be 8-10 characters and include at least one letter and one number.
```

When the typed password is too long, show:

```text
This password has 12 characters. Maximum allowed is 10.
```

This makes it obvious that `Kakinada@123` is not allowed.

### 4. Keep the existing 8-10 character policy
No change will be made to:
- `src/lib/passwordPolicy.ts`
- backend password max-length validation
- current password expiry/history rules

The app will continue enforcing:
- minimum 8 characters
- maximum 10 characters
- at least one letter
- at least one number

### 5. Fix password reset save feedback
After password reset succeeds, show the exact policy-safe outcome without displaying the password:

```text
Password reset successfully. The user can now login with Employee ID and the new password.
```

If reset fails, show the real validation/backend error and do not show generic success.

### 6. Recommended immediate user action after the fix
After this UI fix is applied, reset Chandra’s password again using a valid 8-10 character password, for example:

```text
Kakinada1
```

or another password that follows the policy.

Then Chandra should login with:

```text
Employee ID: 123456
Password: the new 8-10 character password
```

## Files to update

- `src/pages/UserManagement.tsx`
  - Remove silent password truncation.
  - Validate reset password before any other save operations.
  - Add clearer password length feedback.
  - Improve reset success/failure messages.

## Expected Result

After this fix:

- Admins will no longer think a 12-character password was saved.
- Invalid passwords like `Kakinada@123` will be blocked with a clear message.
- Chandra can login using employee ID `123456` after the password is reset to a valid 8-10 character password.
- The app will avoid partial user updates when password validation fails.
