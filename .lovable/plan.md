

## Plan: Call SAP 344 Block API on MRB Submit — Create MRB Only on Success

### Problem
In `ShopFloorMaterialBlocking.tsx` (line 254–255), the SAP material document number is **simulated** with a random string. The MRB record is created regardless of SAP status. The user wants: call SAP 344 first, and only create the MRB if SAP returns success.

### Changes — Single file: `src/pages/ShopFloorMaterialBlocking.tsx`

**1. Import `invokeSapSync`** from `@/lib/sapSyncClient`

**2. Reorder `handleSubmit` (lines 212–278):**

- **Step 1 — Call SAP 344 API first** (before creating MRB)
  - Look up active 344 config from `sap_api_config` (name/endpoint contains "344")
  - Build payload: `MATNR` (stockItem.materialCode), `WERKS` (stockItem.plant), `LGORT` (stockItem.storageLocation), `CHARG` (stockItem.batch), `ENTRY_QNT` (blockQuantity), `ENTRY_UOM` (stockItem.uom), `BUDAT` (postingDate formatted as YYYYMMDD)
  - Call `invokeSapSync({ action: 'unblock', config_id, request_body: payload })`
  - If SAP fails (no CODE 100 / no MBLNR) → show error toast, **stop**, do NOT create MRB
  - If SAP succeeds → extract real `MBLNR`

- **Step 2 — Create MRB record only after SAP success**
  - Move existing `createMRB(...)` call to after SAP confirmation
  - Use the real SAP Material Document number instead of the fake one

- **Step 3 — Update stock status and show confirmation**
  - Same as current: update `shop_floor_stock` status to `mrb_created`
  - Display real MBLNR from SAP in the success screen

**3. Error handling**
- SAP 344 fails → "SAP blocking failed — MRB not created. Please retry."
- SAP succeeds but MRB DB insert fails → warning with the SAP document number so user knows block happened in SAP

### Technical Detail
Reuses the exact same `invokeSapSync` call pattern already working in `ShopFloorStockSelection.tsx` (lines 252–334). Posting date uses `postingDate.replace(/-/g, '')` for YYYYMMDD format.

### Result
- SAP 344 is called when clicking Submit on the MRB form
- MRB document is created only after SAP confirms successful blocking (CODE 100)
- Real SAP Material Document number is stored and displayed
- No orphan MRB records when SAP is unreachable

