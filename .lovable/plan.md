

## Replace Branding Labels: Company & Division Names

### Changes
- "HBL Power Systems" → **"HBL Engineering Limited"**
- "Electronics" / "Electronics Group" → **"Rail Signaling Division"**

### Scope
Replace across all UI, print templates, email templates, and config defaults.

### Files to update (based on prior scan + current branding usage)
1. `src/components/layout/AppSidebar.tsx` — header label
2. `src/components/proposals/ProposalCoverPage.tsx` — cover page
3. `src/components/proposals/TechnicalProposal.tsx` — proposal headers
4. `src/components/proposals/TechnoCommercialProposal.tsx` — proposal headers
5. `src/hooks/usePlantConfig.ts` — fallback defaults (`company_name`, `division_name`)
6. `src/pages/MRBPrint.tsx` — print header fallbacks (both Inward NCR + Shop Floor NCR)
7. `src/pages/MRBCommitteeReview.tsx` — header label
8. `src/pages/ShopFloorMaterialBlocking.tsx` — header label
9. `src/pages/Login.tsx` — if branding present
10. `index.html` — title/meta if present
11. `supabase/functions/send-mrb-email/index.ts` — email template branding (redeploy)

### Approach
- Run a project-wide search for both old strings to catch any additional occurrences before edits.
- Replace each match preserving surrounding markup/casing.
- Redeploy `send-mrb-email` edge function after edit.

### Result
All user-facing surfaces (UI, sidebar, prints, proposals, emails, plant config defaults) display **"HBL Engineering Limited"** and **"Rail Signaling Division"** consistently.

