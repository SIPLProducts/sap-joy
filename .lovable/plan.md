

## Fix: Responsive Font Sizing and Sidebar Typography

### Problem
The current `clamp(13px, 1.4vw, 16px)` base font causes text to shrink too small on narrower screens (at 982px viewport, base font is ~13.7px — and on mobile it hits the 13px floor, which is too small for readability). Sidebar menu items use default small text that lacks visual weight.

### Changes

**1. `src/index.css` — Raise minimum font size and improve scaling**
- Change `clamp(13px, 1.4vw, 16px)` → `clamp(14px, 1.2vw + 4px, 16px)` — this keeps 14px as the floor so text never gets uncomfortably small, and the formula reaches 16px earlier
- Add explicit sidebar font styling for menu items with better letter-spacing and weight

**2. `src/components/layout/AppSidebar.tsx` — Better sidebar typography**
- Add `font-medium tracking-wide` to `SidebarMenuButton` items for better legibility on the dark sidebar background
- Increase icon size from `h-4 w-4` to `h-[18px] w-[18px]` for better visual balance
- Add `text-[0.9rem]` to menu item spans so sidebar text doesn't shrink with the global clamp
- Style group labels (`Navigation`, `Role Dashboards`, `Administration`) with `uppercase text-[0.7rem] tracking-widest font-semibold` for a cleaner section divider look
- Update footer user display name to `text-sm font-semibold` for prominence

**3. `src/components/layout/AppHeader.tsx` — Ensure header text stays readable**
- Quick check and apply `text-sm md:text-base` minimums to any header content that may shrink too small

### Files to modify
1. `src/index.css` — base font clamp adjustment
2. `src/components/layout/AppSidebar.tsx` — sidebar menu typography
3. `src/components/layout/AppHeader.tsx` — header text floor (if needed)

No functionality changes. No database changes.

