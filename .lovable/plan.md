## Plan

Fix plant filtering so the active plant in the top header drives the inward-material screens consistently.

### What will change

1. **MRB - Inward Materials**
   - When the header plant is `1100`, the Plant filter will automatically show/select only `1100`.
   - The records table will immediately show only `1100` records.
   - Changing the header plant to `1300` will update the Plant filter to `1300` and reload/search only `1300` records.
   - Reset will return the page to the current header plant, not blank/all plants.

2. **MRB Inprocess Materials**
   - Apply the same active-plant synchronization and record filtering behavior.

3. **Dropdown behavior**
   - The Plant filter dropdown on these pages will only expose the current active plant, so it cannot show both `1100` and `1300` while the header is set to one plant.
   - Non-master users remain restricted to assigned plants through `useVisiblePlants()` and backend RLS.
   - Master Admin can still switch active plant in the header, but each screen view is scoped to the selected active plant.

### Technical details

- Update `InwardReport.tsx` and `InwardInProcessReport.tsx` to derive an `activePlant` from `profile.plant`, validated against `useVisiblePlants()`.
- Add an effect that keeps `filters.plants` synchronized as `[activePlant]` whenever the header plant changes.
- Make auto-loaded `searchResults` use `getFilteredRecords()` instead of raw `inspectionLotRecords`, so visible records respect the synchronized plant filter.
- Make Reset set `plants: [activePlant]` instead of `plants: []`.
- Adjust the Plant `MultiSelectFilter` options on these screens to include only the active plant.

No database changes are needed for this fix.