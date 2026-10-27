# Manual Routing defaults (Quality Head, Second Quality Head, Stores)

Applies only when the user picks **Use Manual Routing** on the MRB creation screens:
- MRB Inward Materials → Create MRB
- MRB In-Process Materials → Create MRB
- Shop Floor → Block & Create MRB

Predefined workflow, design, emails, SAP calls and all other behavior stay unchanged.

## Behavior

```text
[1] Quality Head  ->  [user-selected steps...]  ->  [Second Quality Head]  ->  [Stores]
```

1. On switching to Manual Routing, the sequence is pre-filled with Quality Head (first), Second Quality Head and Stores.
2. Quality Head, Second Quality Head and Stores show as selected and locked (cannot be unticked or moved). Shown as a separate "Second Quality Head" row so it is clear it is the final quality sign-off.
3. Any other role the user ticks (Purchase, Engineering, Production, MRB Committee, etc.) is inserted between the first Quality Head and the Second Quality Head, in the order ticked; up/down arrows reorder only these middle steps.
4. Stores is always last; Second Quality Head always immediately before Stores. "Apply" smart suggestions also insert into the middle only.
5. Switching back to Predefined restores the existing predefined behavior exactly as today.

## Technical details

- Add a small shared helper `src/lib/manualRoutingDefaults.ts`:
  - `buildManualRouting(middle: string[]) => ['quality_head', ...middle, 'quality_head', 'stores']` (dedups middle, strips locked keys).
  - `getMiddleSteps(seq)` to extract user steps.
- In the 3 pages, only change: `handleWorkflowTypeChange('manual')` initial value, checkbox onChange / `moveRouteStep` / `handleApplyRecommendations` to go through the helper, and render locked rows for the 3 fixed steps. Role keys come from the existing `departments` table (`quality_head`, `stores`).
- The saved routing array contains `quality_head` twice. Verify the existing step-advance logic (workflow routing resolution / approval history) moves to the next index rather than searching by role name; if it searches by name, add an index-based guard so the second Quality Head step is reached and does not loop. No change to Predefined flow.
- Verify end-to-end in preview: create an MRB with manual routing and confirm order and progression through Quality Head → middle → Quality Head → Stores.
