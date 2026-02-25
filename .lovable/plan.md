

# Comprehensive Enhancement Plan: Plant-Based Authorization, Dashboards, Print Forms, Workflow, Email & Nomenclature

This plan covers 8 interconnected features that make the MRB system plant-aware and production-ready.

---

## Current State Assessment

- **Plants in DB:** `1300`, `Plant A`, `Plant B`, `Plant-2000`, `Plant-3000` (inconsistent naming)
- **Plants table:** Only has `Plant-1000`, `Plant-2000`, `Plant-3000`
- **User profiles:** All users are assigned to `Plant-1000` -- no plant-based filtering exists
- **Hardcoded plant list:** `mockData.ts` has `['Plant-1000', 'Plant-2000', 'Plant-3000']`
- **Print forms:** Hardcoded "HBL Power Systems Ltd." / "Electronics Group" -- not plant-aware
- **Dashboards:** No enable/disable mechanism -- all visible based on role only
- **Workflow:** No plant-based routing or restrictions
- **Email:** No auto-triggering -- only manual logging exists
- **Sidebar footer:** Says "© 2024 HBL Power Systems"

---

## 1. Plant-Based Authorization

**Goal:** Users can only see and act on MRB records belonging to their assigned plant.

**Changes:**
- Add `plant` column awareness to all data-fetching queries in `MRBContext.tsx` and `InwardMRBContext.tsx`
- Filter MRB records by `profile.plant` on the client side (since RLS is already permissive)
- Optionally add RLS policies that restrict `SELECT` to `plant = (SELECT plant FROM profiles WHERE user_id = auth.uid())`
- Admin and Executive roles bypass plant filter (see all plants)
- Update `Worklist.tsx`, `KPIDashboard.tsx`, `InwardReport.tsx` to respect plant filtering
- Update the `plants` table to include `1300` and normalize existing data

**Database changes:**
- Insert missing plants (`1300`, `Plant A`, `Plant B`) into `plants` table
- Create a DB function `get_user_plant()` for use in RLS if needed

---

## 2. Dashboard Enabling/Disabling

**Goal:** Admin can configure which dashboards are visible per role and per plant.

**Changes:**
- Create a new `dashboard_config` table:
  ```
  id, dashboard_key (text), plant (text), role (app_role), is_enabled (boolean), created_at
  ```
- Dashboard keys: `kpi`, `quality_head`, `purchase_head`, `engineering_head`, `executive_summary`, `analytics`
- Build an admin UI under User Management to toggle dashboards on/off per plant/role
- Update `AppSidebar.tsx` to check `dashboard_config` before showing dashboard menu items
- Default: all dashboards enabled (backward compatible)

---

## 3. Print Forms Based on Plants

**Goal:** Print forms (NCR/IQC and MRB Committee) show plant-specific headers, nomenclature, and document numbers.

**Changes:**
- Create a `plant_print_config` table:
  ```
  id, plant (text), company_name (text), division_name (text), logo_url (text),
  ncr_doc_number (text), ncr_revision (text), ncr_effective_date (text),
  mrb_doc_number (text), mrb_revision (text), mrb_effective_date (text)
  ```
- Seed with defaults for each plant (e.g., plant 1300 may say "HBL Power Systems Ltd. - Battery Division")
- Update `MRBPrint.tsx` and `MRBCommitteeReview.tsx` to fetch plant-specific config and render accordingly
- Replace hardcoded "Electronics Group" with dynamic `division_name`
- Admin UI to manage print configurations per plant

---

## 4. Workflow Based on Plant

**Goal:** Each plant can have its own workflow routing rules (which departments are involved, in what order).

**Changes:**
- Create a `plant_workflow_config` table:
  ```
  id, plant (text), workflow_step (int), department (app_role),
  is_required (boolean), is_active (boolean), created_at
  ```
- Seed default workflows for each plant (Quality → Purchase → Engineering → Executive)
- Update `InwardMRBDetail.tsx` and `MRBDetail.tsx` to fetch plant-specific workflow when determining next department
- Update `WorkflowProgressIndicator.tsx` to show plant-specific steps
- Admin UI to configure workflow per plant

---

## 5. Access in Existing IMS (Integration Module)

**Goal:** Provide integration hooks so the MRB system can be embedded or accessed from an existing IMS.

**Changes:**
- Create an `/ims-redirect` route that accepts query parameters (`plant`, `mrb_number`, `token`) for deep-linking
- Add SSO-compatible auth flow (token-based redirect)
- Create an edge function `ims-auth` that validates external tokens and creates sessions
- Add CORS configuration for IMS domain origins
- Provide an embed mode (hide sidebar/header) via `?embed=true` query param

---

## 6. Auto Email Triggering

**Goal:** Automatically send email notifications at key workflow transitions.

**Changes:**
- Create an edge function `send-mrb-email` that:
  - Accepts MRB ID, event type, and recipients
  - Composes email using templates per event (new MRB, forwarded, approved, rejected, SLA warning)
  - Sends via a configured email service (Resend, SendGrid, etc.)
  - Logs to `email_logs` table
- Create a DB trigger `on_mrb_status_change` that calls the edge function when `mrb_records.status` changes
- Email recipients are determined by:
  - The `pending_with` role → lookup users with that role + same plant
  - CC to plant head and quality head
- Create `email_templates` table:
  ```
  id, template_key (text), subject_template (text), body_template (text), plant (text), is_active (boolean)
  ```
- Admin UI to manage email templates

---

## 7. Look and Feel

**Goal:** Modernize and polish the UI for production use.

**Changes:**
- Update sidebar footer from "© 2024" to "© 2025"
- Add plant name display in the header bar (next to user role)
- Improve color scheme consistency across dashboards
- Add loading skeletons instead of spinners
- Responsive improvements for tablet/mobile views
- Add breadcrumb navigation for detail pages
- Consistent card shadows and border styles

---

## 8. Nomenclature Changes

**Goal:** Align terminology with business language across the entire application.

**Changes (pending business confirmation, but common ones):**
- "Plant-1000" → actual plant codes from the business (e.g., "1300", "1400")
- "Electronics Group" → dynamic per plant (from `plant_print_config`)
- "Quality Inspector" → "QC Inspector" or as needed
- "Shop Floor" → "Production" (if business prefers)
- "Executive" → "Plant Head" or "GM" (if business prefers)
- "MRB Worklist" → "MRB Task List" (if preferred)
- Update all display name mappings in `getRoleDisplayName()`, `getStatusDisplayName()`
- Update sidebar menu labels
- Update print form labels and field names

---

## Technical Details

### New Database Tables Summary

| Table | Purpose |
|---|---|
| `dashboard_config` | Enable/disable dashboards per plant/role |
| `plant_print_config` | Plant-specific print form headers and doc numbers |
| `plant_workflow_config` | Plant-specific workflow step definitions |
| `email_templates` | Configurable email templates per event/plant |

### New Edge Functions

| Function | Purpose |
|---|---|
| `send-mrb-email` | Auto-send emails on workflow transitions |
| `ims-auth` | Token validation for IMS integration |

### Files to Modify

- `src/contexts/MRBContext.tsx` - Add plant filtering
- `src/contexts/InwardMRBContext.tsx` - Add plant filtering
- `src/components/layout/AppSidebar.tsx` - Dashboard visibility, nomenclature, year
- `src/components/layout/AppHeader.tsx` - Show plant name
- `src/pages/MRBPrint.tsx` - Plant-specific print config
- `src/pages/MRBCommitteeReview.tsx` - Plant-specific print config
- `src/pages/InwardMRBDetail.tsx` - Plant-based workflow
- `src/pages/KPIDashboard.tsx` - Plant-filtered data
- `src/pages/Worklist.tsx` - Plant-filtered data
- `src/data/mockData.ts` - Dynamic plants from DB instead of hardcoded
- `src/contexts/RoleContext.tsx` - Nomenclature updates
- `src/pages/UserManagement.tsx` - Admin config UIs
- `src/hooks/useMRBDatabase.ts` - Auto email trigger on status change

### Implementation Order

1. **Nomenclature + Look and Feel** (quick wins, no DB changes)
2. **Plant-Based Authorization** (DB + context changes)
3. **Dashboard Enabling/Disabling** (new table + sidebar logic)
4. **Print Forms Based on Plants** (new table + print page updates)
5. **Workflow Based on Plant** (new table + detail page updates)
6. **Auto Email Triggering** (edge function + DB trigger + email service setup)
7. **IMS Integration** (edge function + new route)

