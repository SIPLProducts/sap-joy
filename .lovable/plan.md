

# Plan: In-App MRB Proposal Generator (Technical + Techno-Commercial)

## Overview

Build two downloadable PDF proposal pages within the MRB application -- a **Technical Proposal** and a **Techno-Commercial Proposal** -- following the structure and formatting of the reference Sharvi Infotech proposal. These will cover the full MRB system development for HBL Power Systems.

---

## Document Structure

### Proposal 1: Technical Proposal
1. **Cover Page** -- Title, Sharvi Infotech + HBL branding, project name "Material Review Board (MRB) Web Application"
2. **Confidentiality Statement** -- Same structure as reference
3. **Executive Summary** -- MRB system overview, purpose, and value proposition
4. **Scope of Work** -- Full MRB system scope:
   - Inward Inspection & Material Blocking
   - MRB Creation (Quality Inspection + Shop Floor sources)
   - Multi-stage Workflow (Quality → Purchase → Engineering → Final Approval)
   - MRB Committee Review
   - SAP Integration (Stock sync, posting)
   - Role-based Dashboards (Quality Head, Purchase Head, Engineering Head, Plant Head, Executive Summary)
   - Email Notification System
   - Print/PDF Generation (NCR & MRB reports)
   - Analytics & KPI Dashboards
   - User Management & Plant Configuration
5. **Technology Stack** -- React, TypeScript, Tailwind CSS, Lovable Cloud (Supabase), SAP ABAP APIs
6. **Architecture Overview** -- Frontend SPA, backend database, real-time subscriptions, edge functions
7. **Module-wise Feature Breakdown** -- Detailed feature list per module
8. **Integration Points** -- SAP API integration details
9. **Security & Access Control** -- RLS policies, role-based access, authentication
10. **Why SIPL** -- Same as reference

### Proposal 2: Techno-Commercial Proposal
1. **Cover Page**
2. **Confidentiality Statement**
3. **Executive Summary** (brief)
4. **Scope Highlights** -- Summarized from Technical Proposal
5. **Commercial Terms**:
   - Development cost (one-time)
   - Rollout for additional plants
   - AMS services (monthly)
6. **Service Level Agreement** -- Priority matrix (Very High / High / Medium / Low) with response and resolution times
7. **Training Provision**
8. **Additional Scope & Reporting Clause**
9. **Key Assumptions** -- Working hours, contract length, language, CR policy
10. **Terms & Conditions** -- Payment terms, billing, site visits, penalties
11. **Why SIPL / Conclusion**

---

## Implementation Plan

### 1. New Page: `/proposals` (ProposalGenerator.tsx)
- Add a new route and sidebar link under a "Proposals" or "Documents" section
- Page with two cards/tabs: "Technical Proposal" and "Techno-Commercial Proposal"
- Each card has "Preview" and "Download PDF" buttons

### 2. Proposal Content Components
- `src/components/proposals/TechnicalProposal.tsx` -- Renders the full technical proposal as styled HTML
- `src/components/proposals/TechnoCommercialProposal.tsx` -- Renders the techno-commercial proposal as styled HTML
- `src/components/proposals/ProposalCoverPage.tsx` -- Shared cover page component with SIPL + HBL logos
- `src/components/proposals/ProposalStyles.ts` -- Shared print/PDF styles matching the reference format

### 3. PDF Generation
- Reuse the existing `html2pdf.js` dependency (already installed) for PDF export
- Reuse the existing `PrintPreviewModal` pattern for preview with zoom controls
- Page size: A4, orientation: portrait

### 4. Editable Fields (Optional Enhancement)
- Commercial values (costs, rates) stored as editable fields so the user can adjust pricing before export
- Project name, client name, dates as editable header fields

### 5. Sidebar & Routing
- Add route in `App.tsx`
- Add sidebar link in `AppSidebar.tsx`

---

## Technical Details

### Files to Create
- `src/pages/ProposalGenerator.tsx` -- Main page with tab navigation between the two proposals
- `src/components/proposals/TechnicalProposal.tsx` -- Technical proposal content
- `src/components/proposals/TechnoCommercialProposal.tsx` -- Techno-commercial proposal content  
- `src/components/proposals/ProposalCoverPage.tsx` -- Cover page component
- `src/components/proposals/ProposalHeader.tsx` -- Shared header with Sharvi + HBL branding
- `src/components/proposals/ProposalStyles.ts` -- CSS styles for print/PDF output

### Files to Modify
- `src/App.tsx` -- Add `/proposals` route
- `src/components/layout/AppSidebar.tsx` -- Add "Proposals" nav link

### Dependencies
- No new dependencies needed; `html2pdf.js` is already installed

### Content Approach
- All MRB-specific scope content will be derived from the actual system features (modules, tables, workflows) already built in the codebase
- Commercial section will have placeholder amounts that the user can review and adjust
- SLA table will mirror the reference format with MRB-appropriate priority definitions

