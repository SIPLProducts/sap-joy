

## Plan: Make Selection Criteria Section Sticky as Part of the Header

### Problem
The filter section (Plant, Material Code, Vendor, Storage Location, Inspection Lot, Posting Date) scrolls away when users browse the data table, forcing them to scroll back up to change filters.

### Change — Single file: `src/pages/InwardReport.tsx`

Move the "Selection Criteria" card (lines 451–528) from the scrollable content area into the sticky header section (lines 411–443), so the page title, action buttons, and all filters remain pinned at the top while only the results table scrolls.

Specifically:
1. Move the filter `Card` block (lines 452–528) inside the existing `sticky top-0 z-40 bg-background` div, right after the title/buttons row
2. Remove the wrapping `<div className="px-6 py-4 border-b ...">` around it since the sticky header already has padding and border
3. The scrollable area (`flex-1 overflow-auto`) will then contain only the results table and pagination

### Result
The entire top section — title bar, Refresh/Reset/Search buttons, and all Selection Criteria filters — stays visible at all times while the data table scrolls independently beneath it.

