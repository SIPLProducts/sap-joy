

## Email Configuration Admin Screen

### Overview
A new **Email Configuration** page under Administration with two tabs:
1. **SMTP Settings** — configure sender email credentials per plant
2. **Email Templates** — configure email body with dynamic variables per plant, with a guide showing available variables and a sample body

### Database Migration

**New table: `smtp_config`**
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| plant | text (unique) | Plant code, null = global default |
| sender_email | text | From address |
| sender_name | text | Display name |
| smtp_host | text | e.g. smtp.gmail.com |
| smtp_port | integer | e.g. 587 |
| smtp_username | text | Login username |
| smtp_password | text | Password |
| use_tls | boolean | Default true |
| is_active | boolean | Default true |
| created_at, updated_at | timestamptz | |

RLS: Admin-only insert/update/delete, authenticated select.

**Alter `email_templates`** — add 4 columns:
- `to_emails text[]` — explicit recipient emails
- `cc_emails text[]` — explicit CC emails
- `to_roles text[]` — roles to resolve recipients from (plant-filtered)
- `cc_roles text[]` — roles to resolve CC from (plant-filtered)

### Frontend: `src/pages/EmailConfiguration.tsx`

**Tab 1: SMTP Settings**
- Table listing SMTP configs per plant
- Add/Edit dialog: Plant (select), Sender Email, Sender Name, SMTP Host, Port, Username, Password, TLS toggle
- Test Connection button (calls edge function to verify)
- Delete button

**Tab 2: Email Templates**
- Table listing templates grouped by plant
- Add/Edit dialog with:
  - Plant (select), Template Key (event type dropdown), Subject, Body (textarea), To Emails, CC Emails, To Roles (multi-select from departments), CC Roles, Active toggle
  - **Variable Guide panel** on the right side showing all available variables as clickable chips, organized by source:

**Available Variables (shown as guide + sample):**

From `mrb_records`: `{{mrb_number}}`, `{{material_number}}`, `{{material_description}}`, `{{plant}}`, `{{vendor_code}}`, `{{vendor_name}}`, `{{grn_number}}`, `{{po_number}}`, `{{inspection_lot}}`, `{{total_quantity}}`, `{{blocked_quantity}}`, `{{rejected_quantity}}`, `{{uom}}`, `{{quality_decision}}`, `{{defect_category}}`, `{{defect_description}}`, `{{pending_with}}`, `{{final_decision}}`, `{{pending_days}}`, `{{status}}`, `{{batch}}`, `{{storage_location}}`

From `inward_inspection_lots`: `{{posting_date}}`, `{{inspection_date}}`, `{{block_reason}}`, `{{transaction_quantity}}`, `{{po_item_number}}`

**Sample Body (shown as guide in the template editor):**
```text
Dear Material Review Board,

A quality discrepancy has been identified in a recent shipment of {{material_description}} from {{vendor_name}}. To maintain our production schedule and quality standards, we require your collective review and approval on the proposed disposition.

1. Defect Overview
   Total Quantity: {{total_quantity}} {{uom}}
   Blocked Quantity: {{blocked_quantity}} {{uom}}
   Primary Issue: {{defect_description}}
   Quality Decision: {{quality_decision}}
   Defect Category: {{defect_category}}

2. Material & Vendor Details
   Material Code: {{material_number}}
   Plant: {{plant}}
   Vendor Code: {{vendor_code}}
   GRN Number: {{grn_number}}
   PO Number: {{po_number}}
   PO Item: {{po_item_number}}
   Inspection Lot: {{inspection_lot}}

3. Proposed Disposition
   Recommended Action: {{quality_decision}}
   Routed To: {{pending_with}}

4. Required Action
   Please review the Non-Conformance Report (NCR) and provide your decision at the earliest.

Best regards,
Quality Department
```

### Navigation Updates

**`AppSidebar.tsx`** — Add item to `adminItems`:
```
{ title: 'Email Configuration', url: '/admin/email-config', icon: Mail, roles: ['admin'], masterOnly: false }
```

**`App.tsx`** — Add route:
```
<Route path="admin/email-config" element={<EmailConfiguration />} />
```

### Edge Function: `send-mrb-email` Update

1. **Fetch SMTP config** for the MRB's plant (fall back to global/null plant config)
2. **Resolve recipients** from ALL roles in the MRB's `workflow_routing` JSON array (not just `pending_with`), filtered by plant via profiles table. Merge with template's `to_emails`/`to_roles` and `cc_emails`/`cc_roles`
3. **Fetch inspection lot data** by joining on `inspection_lot` number to get `po_item_number`, `posting_date`, etc.
4. **Replace all `{{variable}}` placeholders** dynamically from both MRB record and inspection lot data
5. **Send via SMTP** using `denomailer` with the plant's credentials
6. **Log to `email_logs`** with sent/failed status

### Files Created/Modified
- 1 database migration (create `smtp_config`, alter `email_templates`)
- `src/pages/EmailConfiguration.tsx` (new)
- `src/App.tsx` (add route + import)
- `src/components/layout/AppSidebar.tsx` (add admin menu item)
- `supabase/functions/send-mrb-email/index.ts` (SMTP sending + workflow routing recipients + full variable replacement)

