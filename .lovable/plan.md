

## Three Changes: Remove Duplicate Columns, Move Created Date, Rename Company

### 1. Remove `GRN_ITEM_NO` and `GRN_DATE` dynamic columns from Inward Report

The dynamic field filter in `useDynamicFields.ts` checks `f.map_to_column` against BASE_COLUMNS, but these SAP fields likely have `map_to_column` set to something that doesn't match (or null). Fix: also filter by `field_name` (case-insensitive) so `GRN_ITEM_NO`/`GRN_DATE` are excluded.

**File:** `src/hooks/useDynamicFields.ts`
- Update the `extraFields` filter to also exclude fields where `f.field_name?.toLowerCase()` matches a base column name, or where `f.map_to_column` in any casing matches.

### 2. Move "Created" column after "Material" in MRB Worklist

Currently the column order in the table header is: `...Material, Vendor, Plant, GRN, PO Number, Blocked Qty, UoM, Defect, [Reviews], Pending With, SLA, Created, Escalation, Closure, Actions`.

Move "Created" to appear right after "Material" (after the material code/description column).

**File:** `src/pages/Worklist.tsx`
- Move the `<th>Created</th>` header from line 989 to after "Material" (after line 973)
- Move the `<td>{formatDate(mrb.createdAt)}</td>` cell from lines 1136-1138 to after the Material cell (after line 1037)

### 3. Replace "HBL Power Systems" with "HBL Engineering Limited" everywhere

9 files contain this string. All occurrences will be updated:

| File | Occurrences |
|------|-------------|
| `src/components/layout/AppSidebar.tsx` | 1 |
| `src/components/proposals/ProposalCoverPage.tsx` | 1 |
| `src/components/proposals/TechnoCommercialProposal.tsx` | 5 |
| `src/hooks/usePlantConfig.ts` | 1 |
| `src/pages/MRBPrint.tsx` | 1 |
| `src/pages/MRBCommitteeReview.tsx` | 1 |
| `src/pages/ShopFloorMaterialBlocking.tsx` | 1 |
| `supabase/functions/send-mrb-email/index.ts` | 2 |

All variations (`HBL Power Systems`, `HBL Power Systems Ltd.`) → `HBL Engineering Limited`.

### Files to modify
1. `src/hooks/useDynamicFields.ts` — smarter filter to exclude GRN_ITEM_NO/GRN_DATE
2. `src/pages/Worklist.tsx` — move Created column after Material (header + body)
3. `src/components/layout/AppSidebar.tsx` — rename
4. `src/components/proposals/ProposalCoverPage.tsx` — rename
5. `src/components/proposals/TechnoCommercialProposal.tsx` — rename
6. `src/hooks/usePlantConfig.ts` — rename
7. `src/pages/MRBPrint.tsx` — rename
8. `src/pages/MRBCommitteeReview.tsx` — rename
9. `src/pages/ShopFloorMaterialBlocking.tsx` — rename
10. `supabase/functions/send-mrb-email/index.ts` — rename + redeploy

