

## Fix: Dynamic "Forward to Department" list from workflow_routing

### Problem
The "Select Departments to Forward" checkboxes in `InwardMRBDetail.tsx` and `ShopFloorMRBDetail.tsx` use hardcoded arrays (`nextReviewDepartments` from `inwardReportData.ts` and `shopFloorNextDepartments` from `shopFloorStockData.ts`). These always show Engineering, Purchase, Quality Head, MRB Committee — regardless of which departments were selected during MRB creation.

### Solution
Replace the hardcoded department lists with departments derived from the MRB record's `workflow_routing` array, using `useDepartmentMap` to resolve display names.

### Changes

**1. `src/pages/InwardMRBDetail.tsx`**
- Import `useDepartmentMap` instead of `nextReviewDepartments` from `inwardReportData`
- Build the forward department list from `mrb.workflow_routing`, filtering out the current user's role and any already-completed steps
- Use `roleDisplayNames` from `useDepartmentMap` for labels
- Update all references that resolve department labels (confirmation text, summary text)

**2. `src/pages/ShopFloorMRBDetail.tsx`**
- Same changes: replace `shopFloorNextDepartments` import with dynamic list from `mrb.workflow_routing` + `useDepartmentMap`
- Update label resolution in confirmation and summary text

### Logic
```
// Instead of hardcoded list:
const forwardableDepts = (mrb.workflow_routing as string[] || [])
  .filter(dept => dept !== currentRole)
  .map(dept => ({
    value: dept,
    label: roleDisplayNames[dept] || dept
  }));
```

This ensures only the departments selected during MRB creation appear as forwarding options.

