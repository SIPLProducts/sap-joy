
## Enforce Fresh Login on Production App Open

### Problem
The app currently keeps the authentication session in browser storage. When the user opens the production application again, the stored session is reused and the app logs in automatically. The expected behavior is:

- Opening the app should show the Login page unless the user has logged in during the current browser tab/session.
- Logout should fully delete the user session from the browser so the same user cannot be auto-logged-in again.
- Protected pages should still work normally after a valid login.

## Plan

### 1. Add targeted auth-session cleanup
Create a small auth cleanup helper that removes only authentication-related browser keys, such as:

- `supabase`
- `sb-`
- project auth token keys

This avoids using broad `localStorage.clear()` except where absolutely necessary, so non-auth app data is not accidentally removed.

### 2. Require a fresh login per browser session
Update `src/contexts/AuthContext.tsx` so that on app startup:

- If there is no current-session login marker in `sessionStorage`, clear any persisted auth session from browser storage.
- Do not restore the old saved login automatically.
- Show the Login page.
- After a successful login, set a current-session marker so navigation inside the same active browser session continues to work.

This prevents auto-login when the application is reopened later, while still allowing the user to use the app normally after logging in.

### 3. Strengthen logout behavior
Update the existing `signOut()` flow so logout:

- Calls the backend auth sign-out.
- Clears local React auth state.
- Removes all auth-related localStorage/sessionStorage keys.
- Removes the current-session login marker.
- Leaves the user on `/login`.

This ensures logout fully deletes the browser-side session for that user.

### 4. Clean up direct sign-out calls
Update `src/pages/Login.tsx` password-expiry handling so it uses the same session cleanup logic instead of only calling raw auth sign-out.

### 5. Keep generated backend client untouched
Do not edit `src/integrations/supabase/client.ts`, because it is auto-generated. The session behavior will be controlled from the app’s auth context and login/logout flow.

## Files to update

- `src/contexts/AuthContext.tsx`
  - Add auth storage cleanup helper.
  - Clear old stored sessions on startup when no current-session marker exists.
  - Set marker after successful login.
  - Fully clear auth storage on logout.

- `src/pages/Login.tsx`
  - Replace broad stale-session clearing with targeted auth cleanup.
  - Ensure password-expired sign-out clears auth storage fully.

- `src/components/layout/AppSidebar.tsx`
  - Keep existing logout navigation, relying on the strengthened `signOut()` behavior.

## Result
When users open the production application, they will see the Login page instead of being automatically logged in from an old saved session. After logout, the session will be fully removed, and the user must enter credentials again to access the application.
