
## Fix SAP Unblock false failure in MRB Worklist

### Problem
The SAP unblock action is succeeding in SAP, but the app still leaves the MRB in the “Unblock & SAP Sync” state. On the next attempt, SAP returns a business error like:

```text
Deficit of BA Blocked ...
```

That happens because the frontend/backend currently treat the unblock as successful only when the SAP 343 response returns `CODE === 100`. If SAP already completed the movement, returns a non-standard success, or a retry hits “already unblocked / no blocked stock”, the MRB is never marked as synced locally.

### Exact issue
1. `src/pages/Worklist.tsx`
   - `handleSAPSync()` only marks the MRB synced when `result.success === true`.
   - `handleBatchSync()` is even stricter and does not pass MB52 verification config.
   - `updateMRB(...)` result is not checked before showing success UI.

2. `supabase/functions/sap-sync/handler.ts`
   - `action === 'unblock'` returns `success: false` for every non-`100` SAP code.
   - Even when MB52 verification shows the stock is no longer blocked, that verification is not used to convert the result into a safe success.

### Implementation plan

#### 1. Make unblock flow idempotent in `supabase/functions/sap-sync/handler.ts`
Enhance the unblock response handling so it can succeed in these cases:
- SAP returns business success (`CODE === 100`)
- MB52 verification confirms the blocked quantity is now zero / absent
- SAP returns a retry-style message such as “Deficit of BA Blocked” but MB52 confirms the item is already unblocked

Add normalized response metadata such as:
- `already_unblocked: boolean`
- `verified_unblocked: boolean`

This keeps the existing 200-OK result-object protocol while giving the frontend a reliable outcome.

#### 2. Add verification-based success evaluation in `src/pages/Worklist.tsx`
Update `handleSAPSync()` to:
- inspect SAP response and verification result together
- treat the operation as successful when backend says:
  - `success === true`, or
  - `already_unblocked === true`, or
  - `verified_unblocked === true`

#### 3. Mark MRB synced only after confirmed unblock
When unblock is confirmed, update the MRB with:
```ts
sap_stock_update_status: 'synced'
closure_status: 'completed'
closed_at: new Date().toISOString()
closed_by: user?.id
```

Also check the return value of `updateMRB(...)`. If DB update fails, show a clear message that SAP changed successfully but the application status update failed.

#### 4. Apply the same logic to batch sync
Update `handleBatchSync()` so it:
- passes `verify_config_id: sapMb52ConfigId`
- uses the same idempotent success rules
- marks records synced when SAP is already in the correct state

#### 5. Improve user-facing failure messages
Instead of showing a hard failure for every non-100 SAP message:
- if verification confirms unblock, show success
- if SAP truly failed and MB52 still shows blocked stock, show the SAP message
- keep logging the raw SAP message into sync history for troubleshooting

### Files to update
- `src/pages/Worklist.tsx`
- `supabase/functions/sap-sync/handler.ts`

### Expected result
After this change:
- if SAP unblocks the item, the MRB will be marked as synced/completed in the app
- the Worklist button will switch from `Unblock & SAP Sync` to `SAP Synced`
- retry attempts on already-unblocked items will no longer produce false failures when verification confirms the stock is already released

### Technical notes
- No database schema change is required.
- Keep the existing response contract: HTTP 200 with `{ ok/error/data }`-style result handling.
- Preserve SAP numeric/string formatting rules already used in the request payload.
