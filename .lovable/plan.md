

## Plan: Fix Sticky Header on Inward Materials Screen

### Root Cause
The `<main className="flex-1 overflow-auto">` in `AppLayout.tsx` is the scroll container. When `<main>` scrolls, the "sticky" header inside `InwardReport.tsx` scrolls away with it — `sticky` only works relative to its nearest scrolling ancestor.

### Changes

**1. `src/components/layout/AppLayout.tsx` (line 28)**
- Change `overflow-auto` → `overflow-hidden` on `<main>` so each page controls its own scrolling

**2. `src/pages/InwardReport.tsx`**
- Line 409: Add `overflow-hidden` to root div
- Line 411: Remove `sticky top-0 z-40` (unnecessary with flex layout — `flex-shrink-0` already keeps it pinned)
- Ensure the results table area below has `flex-1 overflow-auto min-h-0` so it scrolls independently

**3. Other pages safeguard**
- Add `overflow-auto` to the root wrapper of pages that currently rely on `<main>` scrolling: Dashboard, Worklist, ShopFloorStockSelection, UserManagement, and all other list/detail pages. This is a one-line className addition per file.

### Result
Title bar + Selection Criteria filters stay permanently fixed at the top. Only the data table scrolls beneath them.

