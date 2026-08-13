# Multi-Select Plant in Top Bar

## Goal
Let users pick more than one plant from the header Plant control, show the selection in the top bar, and have screens load data for all selected plants — without changing any existing behaviour, flow, or business logic.

## Approach
Everything is additive. The current single-plant value (`profile.plant`) and the existing "All Plants" toggle keep working exactly as today; a multi-selection layer sits on top.

### 1. Auth context (additive only)
- Add `selectedPlants: string[]` and `setSelectedPlants()`, persisted in localStorage (same pattern as the existing `mrb.allPlantsView` flag).
- Selection is validated against the plants the user is allowed to see. An empty selection falls back to the current single plant, so users who never touch the control see no change.

### 2. Top bar (AppHeader)
- Turn the Plant pill into a multi-select popover: checkbox list of allowed plants plus "All Plants" and "Clear".
- Label shows the plant code when one is picked, `N plants` (codes shown as chips in the popover) when several, `All Plants` when everything is selected.
- Routes that are single-plant by design (Inward Report, In-Process Report — they sync per plant to SAP) keep today's single-select behaviour.
- Picking exactly one plant still calls `updatePlant()`, so the saved default plant continues to work.

### 3. Screen data
- `useActivePlant` gains `activePlants: string[]`; `activePlant` keeps its current meaning (first selected plant, or `'all'`).
- Plant-scoped screens switch their filter from `eq('plant', activePlant)` to `in('plant', activePlants)` only when more than one plant is selected. Single-plant and All-Plants paths are untouched.

## Technical notes
- Files touched: `src/contexts/AuthContext.tsx`, `src/components/layout/AppHeader.tsx`, `src/hooks/useActivePlant.ts`, and the plant-filter lines in plant-scoped pages (Worklist, Pending Actions, KPI / Analytics / Executive / Head dashboards, MRB Print, Quality Info).
- Allowed plants still come from `useVisiblePlants` (master admin/superadmin see all, others only assigned plants), so RLS scoping is unchanged.
- No workflow, SAP sync, RBAC, or edge-function changes.