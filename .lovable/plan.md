
## Fix “Unblock & SAP Sync” Visibility for Quality

### Requirement
The **Unblock & SAP Sync** action should be available only to:

- Master Admin
- Admin
- Quality

It should not be hidden for Quality users.

### Current issue
In `src/pages/Worklist.tsx`, the visibility rule currently allows:

```ts
masteradmin || admin || quality_head
```

So a user with role `quality` does not see the button.

There is also a second issue: even after showing the button to Quality, the database update after SAP success may fail because approved MRBs usually have `pending_with = null`, and the current MRB update policy mainly allows admins or the current workflow assignee.

## Implementation Plan

### 1. Update the frontend role check
Change the Worklist permission logic from:

```ts
const canUnblockSAP = isMasterAdmin || userRole === 'quality_head' || userRole === 'admin';
```

to allow exactly:

```ts
const canUnblockSAP =
  isMasterAdmin ||
  userRole === 'admin' ||
  userRole === 'quality';
```

This will make **Unblock & SAP Sync** visible for Quality login.

### 2. Apply the same rule to batch SAP sync controls
Currently, approved MRBs can show selection checkboxes and batch sync controls based only on approval status.

Update the Worklist UI so these are shown only when `canUnblockSAP` is true:

- Select All Approved
- Approved-row checkbox
- Batch SAP Sync button
- Single-row Unblock & SAP Sync button

This prevents unauthorized users from selecting approved MRBs for SAP unblock.

### 3. Update database permission for SAP unblock completion
Add a database migration so Quality, Admin, and Master Admin can update approved MRBs for SAP unblock completion.

The policy will allow these users to update approved MRBs where SAP sync is still pending, so the app can save:

- `sap_stock_update_status = 'synced'`
- `closure_status = 'completed'`
- `closed_at`
- `closed_by`

This is required because the SAP call can succeed, but the app still needs permission to mark the MRB as synced.

### 4. Add backend protection for SAP unblock action
Update the SAP sync backend function so the `unblock` action checks the logged-in user before calling SAP.

Allowed users:

- Master Admin email
- role `admin`
- role `quality`

If another role tries to trigger `unblock`, the backend will return an authorization error.

This prevents someone from bypassing the hidden UI and calling the SAP unblock function directly.

### 5. Keep SAP Sync History readable, but restrict unblock execution
The existing SAP Sync History dialog can remain visible unless you want it hidden separately.

The action itself will be protected both:

- in the UI
- in the backend function

### 6. Verify behavior
After implementation:

- Quality login will see **Unblock & SAP Sync** for approved, not-yet-synced MRBs.
- Admin will see it.
- Master Admin will see it.
- Purchase, Engineering, Stores, Shop Floor, and other roles will not see it.
- Batch SAP Sync controls will also be hidden for unauthorized roles.
- Quality can complete the SAP unblock and the MRB will update to SAP synced successfully.

## Files and systems involved

### Code
- `src/pages/Worklist.tsx`
- `supabase/functions/sap-sync/handler.ts`

### Backend
- database migration for MRB SAP unblock update permission

## Expected Result
Quality users will be able to perform **Unblock & SAP Sync**, while the action remains restricted to only Master Admin, Admin, and Quality.
