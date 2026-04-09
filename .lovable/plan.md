

## Plan: Match User Management Scroll Pattern on Inward Materials Screen

### What the User Management Screen Does
The page body scrolls normally (header, stats cards, filters all scroll together). The **data table** sits inside a `max-h-[60vh] overflow-auto` container with `sticky top-0` on `TableHeader` — so column headers stay visible while table rows scroll.

### What Inward Materials Currently Does
The entire header + filters are locked in place (`flex-shrink-0 overflow-hidden`) and the content area below scrolls via `flex-1 overflow-auto`. This means the filters always consume screen space, leaving less room for data.

### Change — `src/pages/InwardReport.tsx`

1. **Remove the flex-column pinned-header layout**: Change the root div from `flex flex-col h-full overflow-hidden` to a simple `overflow-auto h-full` scrollable page (like User Management)
2. **Remove `flex-shrink-0`** from the header/filter section — let it scroll with the page
3. **Wrap the results Table** in `<div className="max-h-[60vh] overflow-auto">` and keep `<TableHeader className="sticky top-0 z-20 bg-muted/80 backdrop-blur-sm">` — this gives the table its own scroll with sticky column headers
4. Remove the outer `flex-1 overflow-auto min-h-0` wrapper around the content area since the page itself now scrolls

### Result
- Page scrolls normally: title, filters, bulk actions all scroll up naturally
- Data table has its own scroll area (60vh) with column headers always visible — exactly like User Management

