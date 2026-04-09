

## Plan: Improve Pagination on Material Blocking Screen

### Problem
With 2304 records and only 10 per page, users must click "Next" 230 times. The current pagination has no page-size selector and no way to jump to a specific page.

### Changes — Single file: `src/pages/ShopFloorStockSelection.tsx`

1. **Increase default page size** from 10 to 50, and add a page-size dropdown (25 / 50 / 100 / 200)
2. **Add page number buttons** with ellipsis for large ranges (e.g., 1 2 3 ... 45 46 47) — reuse the existing `Pagination` UI components from `src/components/ui/pagination.tsx`
3. **Add "Go to page" input** — a small number input + Go button to jump directly to any page
4. **Reset to page 1** when page size changes

### Result
Users can browse all 2304 records efficiently — choose how many rows to see per page, click specific page numbers, or jump directly to any page.

