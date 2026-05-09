## Goal

Make `user_plants` the single source of truth for plant visibility. A user — admin or otherwise — sees only the plants explicitly assigned to them. Pradeep (assigned `1100`) will then see only `1100` data.

## Changes

### 1. `useVisiblePlants` hook
- Drop the admin/executive "all plants" branch.
- Drop the `profile.plant` union.
- Return exactly the codes from `user_plants`.
- If a user has zero `user_plants` rows, return an empty array (screens render empty rather than leak other plants).

### 2. RLS — `user_has_plant` function (migration)
Today it returns `true` for any admin/executive. Replace its body so admin/executive no longer get a free pass:

```sql
CREATE OR REPLACE FUNCTION public.user_has_plant(_user_id uuid, _plant text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _plant IS NULL OR EXISTS (
    SELECT 1 FROM public.user_plants
    WHERE user_id = _user_id AND plant_code = _plant
  );
$$;
```

This automatically scopes `mrb_records`, `mrb_attachments`, `mrb_approval_history`, `inward_inspection_lots`, `zmrb_inward_report`, and `shop_floor_stock` for every role.

### 3. Header plant switcher (`AppHeader`)
- Source the dropdown options from `user_plants` only (no `usePlants()` fallback for admin).
- Hide the switcher when the user has 0 or 1 assigned plants.
- "Default Plant" still seeds new-record forms; it must be one of the assigned plants.

### 4. Data fix for Pradeep
His `profiles.plant` is currently `1300` but he's only assigned `1100`. Update `profiles.plant` to `1100` so the create-form default matches his access.

### 5. Master Admin
The `masteradmin@sharviinfotech.com` account remains a superuser via existing JWT-email checks in MRB UPDATE policy and frontend guards — unaffected by this change. (If master admin also needs visibility everywhere, we'll seed `user_plants` rows for every plant, or add a narrow JWT-email exception inside `user_has_plant`. Default plan: seed all plants for master admin.)

## Out of scope
- No changes to scheduler (already iterates `scheduler_plants`).
- No changes to SAP transactional posts (still use the record's own `plant`).
- No new UI plant filter chips.

## Files touched
- `src/hooks/useVisiblePlants.ts`
- `src/components/layout/AppHeader.tsx`
- New migration: redefine `user_has_plant`
- Data update: `profiles.plant` for Pradeep, seed `user_plants` for masteradmin
- Memory: update `mem://features/active-plant-scope` / multi-plant entries to reflect strict assigned-plants-only rule
