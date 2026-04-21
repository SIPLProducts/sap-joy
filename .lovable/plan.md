
## Fix False Success for SAP Unblock & Sync

### Problem
The current unblock logic is now too permissive. It can show **success** even when SAP did not actually unblock the stock.

From the screenshot and logs, the issue is:

- SAP 343 response returns:
  ```text
  CODE: 200
  MSG: Deficit of BA Blocked ...
  ```
  This is not a successful unblock document creation.

- The app currently treats messages like **Deficit of BA Blocked** as `already_unblocked=true`.

- MB52 verification is also being interpreted incorrectly:
  - It shows `Records found: 1`
  - But Material / Batch / Plant / SLoc are blank
  - Blocked Qty is shown as `0` only because the expected fields are missing
  - Logs show MB52 returned:
    ```json
    {"CODE":"200","MSG":"Request Payload is empty","MBLNR":"","MJAHR":0}
    ```
  - That is not valid stock verification.

So the app is marking the MRB as synced based on an invalid verification response and a SAP business error.

## Implementation Plan

### 1. Remove unsafe “Deficit of BA Blocked = success” behavior
Update `supabase/functions/sap-sync/handler.ts`.

Current unsafe behavior:
```ts
effectiveSuccess = isBusinessSuccess || verifiedUnblocked || alreadyUnblocked
```

Change it so:

- `CODE === 100` remains success.
- `Deficit of BA Blocked` is not automatically success.
- Deficit / already-unblocked messages can only be considered success if MB52 verification is valid and proves the item has no blocked stock.

New logic:
```ts
effectiveSuccess =
  isBusinessSuccess ||
  (alreadyUnblockedMessage && verifiedUnblocked === true)
```

This prevents SAP business errors from being shown as successful unless verification is reliable.

### 2. Make MB52 verification strict and valid
Update `isVerifiedUnblocked(...)` in `supabase/functions/sap-sync/handler.ts`.

It should only return `true` when MB52 returns valid stock data.

Reject verification as invalid when the response contains only SAP message fields like:

```json
{
  "CODE": "200",
  "MSG": "Request Payload is empty"
}
```

A valid MB52 record must contain at least one real stock identifier/quantity field such as:

- `MATNR`
- `WERKS`
- `LGORT`
- `CHARG`
- `SPEME`
- `LABST`
- mapped equivalents like `material_code`, `plant`, `storage_location`, `batch`, `blocked_quantity`

If MB52 does not return valid stock rows, verification should be:

```ts
verified_unblocked: false
verification.error: 'MB52 verification did not return valid stock records'
```

### 3. Match MB52 result against the exact MRB item
Pass the original SAP 343 request values into the verification helper:

- Material: `MATNR`
- Plant: `WERKS`
- Storage Location: `LGORT`
- Batch: `CHARG`

Then verify only matching MB52 rows.

A row should count only if it matches the requested material, plant, storage location, and batch after normalizing leading zeros where needed.

This prevents the app from using unrelated MB52 data to mark the MRB as synced.

### 4. Treat zero blocked stock carefully
For non-100 SAP responses:

- If MB52 returns a matching valid stock row and blocked quantity is `0`, then mark as success.
- If MB52 returns matching valid stock row and blocked quantity is greater than `0`, keep failure.
- If MB52 returns no valid matching stock row, do not automatically mark success.
- If MB52 itself returns “Request Payload is empty”, keep failure.

This avoids false success while still supporting true already-unblocked cases.

### 5. Improve Worklist frontend handling
Update `src/pages/Worklist.tsx`.

The frontend should only show success when the backend returns:

```ts
success === true
```

It should not independently treat these flags as success unless the backend has already combined them safely:

```ts
already_unblocked
verified_unblocked
```

Update `isSapUnblockConfirmed(...)` to avoid frontend-side false positives.

### 6. Improve the success toast wording
Update the success toast in `Worklist.tsx`.

If SAP returns `CODE === 100`, show:

```text
SAP unblock completed successfully.
Material Document: ...
```

If SAP returns a non-100 code but verified unblocked through MB52, show:

```text
SAP already appears unblocked. Confirmed by valid MB52 verification.
```

If MB52 verification is invalid, show failure instead of success.

### 7. Improve failure message for this exact case
When SAP returns:

```text
Deficit of BA Blocked ...
```

and MB52 verification is invalid or still blocked, show:

```text
SAP did not confirm unblock. MB52 verification did not prove the stock is unblocked, so the MRB was not marked as synced.
SAP Message: Deficit of BA Blocked ...
```

This makes it clear why the app did not update the MRB.

### 8. Deploy updated backend function
After code changes, deploy the updated `sap-sync` backend function so production uses the corrected verification logic.

### Files to update

- `supabase/functions/sap-sync/handler.ts`
  - Make unblock success evaluation stricter.
  - Require valid MB52 verification for non-100 SAP responses.
  - Reject “Request Payload is empty” as verification failure.
  - Match MB52 records to requested material/plant/storage/batch.

- `src/pages/Worklist.tsx`
  - Stop frontend from treating loose flags as success.
  - Improve success/failure toast messages.

### Expected Result
After this fix:

- SAP `CODE === 100` will still show success and mark MRB as synced.
- `Deficit of BA Blocked` will no longer show success by itself.
- Invalid MB52 responses like `Request Payload is empty` will not be treated as proof of unblock.
- The MRB will only move to **SAP Synced / Completed** when SAP actually confirms the unblock or valid MB52 verification proves the blocked quantity is zero.
