
Goal: make MRB Submit use the exact same SAP block behavior as “Block Selected”, and stop the repeated blocking failure.

What I found
- The SAP block call is reaching the backend. Recent logs show real transactional SAP responses coming back, including:
  - success: `CODE: "100"` with `MBLNR`
  - business failure: `CODE: "200"` with messages like stock deficit
- So the main issue is response handling, not just “API not called”.

Plan

1. Normalize transactional SAP success/failure
- File: `supabase/functions/sap-sync/index.ts`
- In the `action === 'unblock'` branch, stop returning `success: true` for every HTTP 200.
- Mark the call successful only when SAP business response is truly successful:
  - `CODE === '100'`
  - and a material document exists
- Return a consistent payload with both normalized and legacy keys:
  - `success`, `error`
  - `code` and `CODE`
  - `message` and `MESSAGE`
  - `material_document` and `MBLNR`
  - `material_document_year` and `MJAHR`

2. Keep direct/self-hosted mode identical
- File: `src/lib/sapSyncClient.ts`
- Update `directUnblock()` to use the same business-success rule as the backend function.
- This keeps cloud and direct mode behavior aligned.

3. Fix MRB submit flow
- File: `src/pages/ShopFloorMaterialBlocking.tsx`
- Read normalized transactional fields first:
  - `code/message/material_document`
- Use legacy fallback only if needed.
- Only create the MRB after confirmed SAP success (`CODE 100` + document number).
- If SAP returns a business error like deficit, show that exact SAP message and do not create the MRB.

4. Make “Block Selected” use the same exact rule
- File: `src/pages/ShopFloorStockSelection.tsx`
- Update its success/failure check to the same normalized logic.
- This ensures the trusted button and the MRB submit flow behave exactly the same.

5. Small cleanup to prevent drift
- If needed, extract one shared transactional-response parser/helper so both screens cannot diverge again.

Technical details
- Current issue:
  - transactional HTTP 200 is being treated as success even when SAP business `CODE` is not `100`
  - MRB submit is also reading the wrong document field path in some cases
- Target behavior:
  - SAP success only when business response is truly successful
  - no MRB document created unless SAP confirms the block and returns a real material document
- No database schema changes are needed.

Validation
- Test success path:
  1. select one material
  2. proceed to MRB
  3. submit
  4. confirm SAP returns `CODE 100`
  5. confirm MRB is created only then
- Test failure path:
  1. trigger a known SAP business failure
  2. confirm exact SAP message is shown
  3. confirm no MRB is created
- Re-test “Block Selected” end-to-end and confirm both flows now behave the same.
