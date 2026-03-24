

# Fix MB52 500 Error and ZMRB01 Empty Data

## Problem 1: MB52 returns 500 Internal Server Error

In `directSync` (line 174-180), the request body is built by including ALL configured request fields with `field.default_value ?? ''`. Non-required fields like `MATNR` and `CHARG` with null defaults are sent as empty strings `""`, which SAP rejects.

**Fix**: Only include fields that have a non-empty default value OR are marked `is_required`.

## Problem 2: ZMRB01 syncs "successfully" but no data appears

Two causes:

**A.** The `allowedColumnsByTable.inward_inspection_lots` (line 443) is missing `inspection_date` and `posting_date`. These columns exist in the DB table but are silently dropped during mapping.

**B.** If SAP response field names don't match the configured `sap_field_name` exactly (case-sensitive), the value comes back as `undefined` and required fields like `inspection_lot`, `material_code`, `plant` end up missing — causing every row to be skipped with "missing required fields" errors that only appear in the sync history, not in the UI toast.

## Changes

### File: `src/lib/sapSyncClient.ts`

**1. Fix request body builder (lines 174-180)**
```typescript
if (['POST', 'PUT', 'PATCH'].includes(method) && requestFields?.length) {
  requestBody = {};
  requestFields.forEach((field: any) => {
    const key = field.sap_field_name || field.field_name;
    // Only include fields that have a value or are required
    if (field.is_required || (field.default_value && field.default_value.trim() !== '')) {
      requestBody[key] = field.default_value ?? '';
    }
  });
}
```

**2. Add `inspection_date` and `posting_date` to allowed columns (line 443)**
Add these two columns to the `inward_inspection_lots` allowed set.

**3. Add SAP date normalization**
Add a helper that converts `YYYYMMDD` and `/Date(ms)/` formats to `YYYY-MM-DD` for Postgres date columns. Apply it to `inspection_date` and `posting_date` before insert.

**4. Add case-insensitive SAP field lookup (line 489)**
When reading `record[field.sap_field_name]`, also try a case-insensitive match against the record keys, since SAP field names can vary in casing between systems.

**5. Surface skipped-row errors in sync result**
When all rows are skipped due to missing required fields, include the first skipped row's raw data in the error message so you can see exactly which fields SAP returned vs. what was expected.

### No other files change
All pages already consume `invokeSapSync()` and check `data.success`.

