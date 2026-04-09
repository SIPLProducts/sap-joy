

## Plan: Fix SAP 344 Block Action Error on MRB Submit

### Problem
The edge function `sap-sync` does not have a `'block'` action handler. It only supports: `test`, `sync`, `unblock`, `fetch_live`, `update_transaction_qty`. The MRB submission in `ShopFloorMaterialBlocking.tsx` sends `action: 'block'`, which hits the fallback error: *"Invalid action. Use test, sync, unblock..."*

The Stock Selection screen (`ShopFloorStockSelection.tsx`) already works because it sends `action: 'unblock'` for its SAP 344 calls — the `unblock` handler is a generic transactional proxy that works for both 343 and 344 APIs (the config determines which SAP endpoint is called).

### Fix — Single file: `src/pages/ShopFloorMaterialBlocking.tsx`

**Change `action: 'block'` to `action: 'unblock'`** (line ~254)

The `unblock` action in the edge function is a generic transactional proxy — it reads the SAP endpoint URL from the config record (which points to the 344 API), builds auth headers, and forwards the request body. The action name is misleading but functionally correct for both 343 and 344 calls.

This is the same pattern already used successfully in `ShopFloorStockSelection.tsx` (line 300: `action: 'unblock', // reuses same edge function action for transactional posting`).

### Result
- MRB submission will correctly call SAP 344 Block API via the existing `unblock` handler
- No edge function changes needed
- Matches the working pattern in the Stock Selection screen

