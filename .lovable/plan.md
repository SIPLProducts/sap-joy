

## Add Employee ID (mandatory) + Employee Email + Login with Employee ID

### Problem
1. No Employee ID or Employee Email fields in Create/Edit User dialogs
2. No uniqueness constraint on `employee_id` in the database
3. Users can only log in with email, not employee ID
4. Employee ID should be mandatory

### Changes

**1. Database migration — unique constraint + make employee_id NOT NULL with default**
```sql
-- Add unique partial index (allows no duplicates for non-null values)
CREATE UNIQUE INDEX IF NOT EXISTS unique_employee_id ON public.profiles(employee_id) WHERE employee_id IS NOT NULL;

-- Make employee_id NOT NULL with a temporary default for existing rows
-- (existing rows without employee_id get their email prefix as fallback)
UPDATE public.profiles SET employee_id = split_part(email, '@', 1) WHERE employee_id IS NULL;
ALTER TABLE public.profiles ALTER COLUMN employee_id SET NOT NULL;
```

**2. Update `src/pages/UserManagement.tsx`**
- Add `employee_id` to `UserWithRole` interface
- Add state: `newUserEmployeeId`, `editEmployeeId`
- **Create User dialog**: Add mandatory "Employee ID" input field; validate uniqueness before save by querying `profiles`; save to profile on creation
- **Edit User dialog**: Add "Employee ID" input field, pre-populated on edit open; validate uniqueness (excluding current user) before save; update profile
- **Users table**: Add "Employee ID" column between Name and Email
- **fetchUsers**: Map `employee_id` from profiles data
- **Search filter**: Include `employee_id` in search
- **handleCreateUser**: Include `employee_id` in profile update, check uniqueness first
- **handleSaveEdit**: Include `employee_id` in profile update, check uniqueness first

Uniqueness check (client-side, before save):
```typescript
const { data: existing } = await supabase.from('profiles')
  .select('user_id').eq('employee_id', employeeId)
  .neq('user_id', currentUserId).maybeSingle();
if (existing) → toast "Employee ID already in use", return
```

**3. Update `src/pages/Login.tsx`**
- Change sign-in label from "Email" to "Email or Employee ID"
- Before calling `signIn()`, check if input contains `@`:
  - If yes → use as email directly
  - If no → treat as employee ID, look up email from `profiles` table, then sign in with that email
- Show appropriate error if employee ID not found

**4. Update `src/pages/UserProfile.tsx`**
- Add uniqueness check before saving employee_id changes

**5. Update `handle_new_user()` trigger**
- Update the trigger function to also set `employee_id` from metadata if provided, or default to email prefix

### Files modified
- Database migration (unique index + NOT NULL)
- `src/pages/UserManagement.tsx`
- `src/pages/Login.tsx`
- `src/pages/UserProfile.tsx`

