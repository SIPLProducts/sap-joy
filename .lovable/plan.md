

## Fix: Employee ID Login Fails Due to RLS

### Root Cause
The `profiles` table's RLS policy (`Authenticated users can view all profiles`) blocks SELECT for unauthenticated users. The employee ID → email lookup in `Login.tsx` runs **before** authentication, so the query returns no rows, causing "Employee ID not found."

### Solution
Create a `SECURITY DEFINER` database function that looks up the email by employee ID, bypassing RLS. Then call it from `Login.tsx` via `.rpc()`.

### Changes

**1. Database migration — create `get_email_by_employee_id` function**
```sql
CREATE OR REPLACE FUNCTION public.get_email_by_employee_id(_employee_id text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT email FROM public.profiles WHERE employee_id = _employee_id LIMIT 1;
$$;
```
This runs with elevated privileges, bypassing RLS, so unauthenticated users can resolve employee ID → email.

**2. Update `src/pages/Login.tsx`**
Replace the direct `supabase.from('profiles').select('email').eq('employee_id', ...)` query with:
```typescript
const { data: email } = await supabase.rpc('get_email_by_employee_id', {
  _employee_id: loginEmail
});
if (!email) {
  setLoginError('Employee ID not found.');
  return;
}
loginEmail = email;
```

### Files modified
- Database migration (new RPC function)
- `src/pages/Login.tsx` (use `.rpc()` instead of direct table query)

