

## Plan: Add Sticky Table Headers Across All Screens

### Problem
When users scroll through data tables, column headers disappear, making it hard to identify which field each column represents.

### Current State
- **Already has sticky headers**: `InwardReport.tsx`, `Worklist.tsx`
- **Missing sticky headers** (13 screens):
  - `ShopFloorStockSelection.tsx`
  - `PurchaseHeadDashboard.tsx`
  - `QualityHeadDashboard.tsx`
  - `ExecutiveSummaryDashboard.tsx`
  - `EngineeringHeadDashboard.tsx`
  - `PlantHeadDashboard.tsx`
  - `UserManagement.tsx`
  - `PlantManagement.tsx`
  - `DepartmentManagement.tsx`
  - `EmailLog.tsx`
  - `WorkflowRoutingConfig.tsx`
  - `SAPApiSettings.tsx`
  - `SAPSyncMonitor.tsx`

### What Changes

For every table missing sticky headers, two changes are applied:

1. **Wrap the table's parent `<div className="rounded-md border">` with overflow control**:
   ```html
   <div className="rounded-md border max-h-[60vh] overflow-auto">
   ```

2. **Add sticky classes to `<TableHeader>`**:
   ```html
   <TableHeader className="sticky top-0 z-10 bg-muted/80 backdrop-blur-sm">
   ```

This matches the existing pattern used in `InwardReport.tsx` and `Worklist.tsx`.

### Result
All data tables will keep column headers visible while scrolling, enabling users to always see field names for data analysis.

