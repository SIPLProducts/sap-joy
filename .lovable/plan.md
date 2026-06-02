## Refine Header Plant Switcher UI

The previous redesign made dropdown items too tall (two-line layout with icons) and the trigger background (`bg-primary/5`) looks washed out. Goal: tighter, livelier dropdown.

### Changes — `src/components/layout/AppHeader.tsx`

**Trigger container**
- Replace dull `bg-primary/5` with a richer `bg-primary text-primary-foreground` pill (or `bg-gradient-to-r from-primary to-primary/80`), white icon and label, subtle shadow on hover.
- Keep compact height (`h-8`), reduce horizontal padding to `px-3`.

**Dropdown content**
- Reduce min-width from 220px to ~170px.
- Compact items: single-line layout, `py-1.5` (not `py-2.5`), small icon + code + light-muted plant name inline (`code — name`).
- Stronger hover/focus: `focus:bg-primary focus:text-primary-foreground`.
- "All Plants" option visually separated with a `border-b` divider and slightly emphasized (`font-semibold text-primary`).

### Out of scope
No logic changes. `useActivePlant` + `isAllPlantsView` behavior stays as-is.