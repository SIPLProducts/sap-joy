

## Plan: Three Fixes

### 1. Add "Email Configuration" to Role Access Matrix & Make Admin Tabs Permission-Driven

**Problem:** The `SCREENS` array in `RoleMatrix.tsx` doesn't include `email_config`. Also, the sidebar's Administration section (line 151) only shows for `userRole === 'admin'` — it ignores per-role permissions from the matrix.

**Changes:**
- **`src/pages/RoleMatrix.tsx`** — Add `{ key: 'email_config', label: 'Email Configuration', group: 'Administration' }` to the `SCREENS` array.
- **`src/components/layout/AppSidebar.tsx`** — Refactor the Administration section:
  - Add `matrixKey` to each admin item (e.g., `user_management`, `role_management`, `role_access`, `plant_management`, `workflow_config`, `email_config`).
  - Replace the `userRole === 'admin'` guard with permission-based filtering via `hasAccess(item.matrixKey)`. Master-only items (SAP) still require `isMasterAdmin`.
  - Show the Administration group if any admin item passes the access check.

### 2. Login Page — Employee ID Only (Email for MasterAdmin Only)

**Problem:** Login label says "Email or Employee ID" and accepts both. Only masteradmin should log in with email.

**Changes in `src/pages/Login.tsx`:**
- Change label from "Email or Employee ID" to "Employee ID"
- Change placeholder to "Enter your Employee ID"
- Keep the existing logic that resolves employee ID to email (line 115: `if (!loginEmail.includes('@'))`) — this still works. If someone types an email (masteradmin), it will pass through directly.
- Remove the Sign Up tab entirely (users are created by admin only via User Management). Only show Sign In.

### 3. Remove Engineering "Final Decision" Override — Follow Workflow Routing

**Problem:** In `InwardMRBDetail.tsx` (lines 166-182), engineering roles are hardcoded as final decision-makers, bypassing the workflow routing sequence. The forwarding UI is hidden for engineering (line 494-550), and a "final acceptance" notice is shown (line 552-556).

**Changes in `src/pages/InwardMRBDetail.tsx`:**
- Remove the special `if (userRole === 'engineering' || userRole === 'engineering_head')` block (lines 166-182) that forces `approved`/`rejected` status.
- Instead, use the same workflow routing logic as other roles: use `getNextWorkflowStep()` from `workflowRouting.ts` to determine the next step based on the MRB's `workflow_routing` array.
- Remove the condition hiding the "Forward to department" UI for engineering (line 494-495).
- Remove the "Engineering Final Acceptance" notice (lines 552-556).
- Engineering will now follow the exact same flow as all other departments — if there are more steps in the routing after engineering, it forwards; if engineering is last, then it becomes the final approver.

### Files Modified
1. `src/pages/RoleMatrix.tsx` — add `email_config` screen
2. `src/components/layout/AppSidebar.tsx` — permission-driven admin section
3. `src/pages/Login.tsx` — Employee ID only label, remove Sign Up tab
4. `src/pages/InwardMRBDetail.tsx` — remove engineering final decision override

