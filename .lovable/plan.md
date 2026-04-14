

## Fix: Worklist Table Scroll Behavior and Global Font Size Increase

### Problem
1. The worklist table container uses `h-full` + `overflow-hidden` + `flex-1`, which forces the table area to fill the entire remaining viewport. When there are only 1-2 records, the horizontal scrollbar sits at the very bottom of the screen instead of right below the last row.
2. Font sizes throughout the application could be slightly larger for better readability.

### Changes

**1. `src/pages/Worklist.tsx` — Fix scroll container to shrink-wrap with few records**
- Change the outer scrollable container from `flex-1 overflow-hidden` to `flex-1 min-h-0 overflow-auto` so it can scroll when needed but doesn't force full height
- Change the inner table wrapper from `h-full ... overflow-hidden flex flex-col` to `max-h-full ... overflow-hidden flex flex-col` — this lets it shrink to content size when records are few
- Change the table scroll area from `flex-1 overflow-auto` to `overflow-auto` — remove the flex-1 so the table area only takes the height it needs
- This way: few records → scrollbar hugs the content; many records → scrollbar at viewport bottom as before

**2. `src/index.css` — Bump global font size floor**
- Change `clamp(14px, 1.2vw + 4px, 16px)` → `clamp(14.5px, 1vw + 6px, 17px)` — this raises the minimum by 0.5px, reaches 17px on large screens, and generally makes text slightly larger everywhere
- Bump `h1` from `text-xl md:text-2xl` → `text-2xl md:text-3xl`
- Bump `h2` from `text-lg md:text-xl` → `text-xl md:text-2xl`

### Files to modify
1. `src/pages/Worklist.tsx` (lines 958-961)
2. `src/index.css` (lines 117-132)

No functionality changes. No database changes.

