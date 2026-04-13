

## Fix: Scheduler showing all inward records as "updated" instead of "inserted"

### Problem
In the `mapAndInsertData` function (line 927-956 of `sap-sync-scheduler/index.ts`), the insert-vs-update counting uses arithmetic: `newInserts = totalProcessed - existingCount`. This is unreliable because:
- If SAP returns duplicate `inspection_lot` values, upsert deduplicates them, reducing `totalProcessed`
- The `count` query with `.in()` can return a value >= `totalProcessed`, making `newInserts = 0`
- Result: all records appear as "updated" even when genuinely new ones exist

### Fix
Replace the arithmetic-based counting with explicit key-set comparison:

**File: `supabase/functions/sap-sync-scheduler/index.ts`** (lines 927-956)

Replace the inward_inspection_lots upsert block with:

```typescript
} else if (tableName === 'inward_inspection_lots') {
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize)

    // Pre-fetch existing inspection_lot keys as a Set
    const lotKeys = batch.map((r: any) => r.inspection_lot).filter(Boolean)
    const existingKeys = new Set<string>()
    if (lotKeys.length > 0) {
      const { data: existingRows } = await supabase
        .from(tableName)
        .select('inspection_lot')
        .in('inspection_lot', lotKeys)
      for (const row of existingRows || []) {
        existingKeys.add(row.inspection_lot)
      }
    }

    // Count genuinely new keys before upsert
    const newKeyCount = lotKeys.filter(k => !existingKeys.has(k)).length

    const { data, error } = await supabase
      .from(tableName)
      .upsert(batch, { onConflict: 'inspection_lot', ignoreDuplicates: false })
      .select()
    if (error) {
      console.log(`[scheduler] Upsert error for ${tableName}:`, error.message)
      result.errors.push(`Error upserting into ${tableName}: ${error.message}`)
      break
    }
    const totalProcessed = data?.length || 0
    result.inserted += newKeyCount
    result.updated += Math.max(0, totalProcessed - newKeyCount)

    console.log(`[scheduler] ${tableName} batch: ${newKeyCount} new, ${totalProcessed - newKeyCount} updated`)
  }
}
```

### What changes
- Instead of `SELECT count(*)`, we `SELECT inspection_lot` to build a Set of existing keys
- We count new keys by checking which batch keys are NOT in the existing Set
- This gives accurate insert/update counts regardless of SAP duplicates or upsert deduplication
- Added a per-batch log line for easier debugging on the production server

### No database or migration changes needed.

