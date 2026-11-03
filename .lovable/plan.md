# Fix: "Unblock & SAP Sync" button still showing after a successful sync (MRB-2026-0058)

## What is wrong
SAP unblocked the stock, but the app could not save "synced" on the MRB. The database rules only let the department the MRB is waiting on (Stores) save changes. Quality Head was blocked without any error, so the record still says "pending" and the button stays.

## What will change (only additions, nothing else touched)

1. **Database rule (one new rule added, existing rules kept as they are)**
   A new update rule lets Quality Head, Quality and Admin save changes to an MRB when Quality Head chose "Accept under deviation", even while it waits on Stores.

2. **SAP sync function (small addition)**
   When SAP confirms success for an unblock, the sync function also saves `sap_stock_update_status = 'synced'` on the MRB itself. This happens on the server, so the status gets saved even if the browser update is blocked. The current logic and messages stay the same.

3. **One-time data fix**
   Set MRB-2026-0058 to "synced" so the button disappears now. Its SAP stock was already unblocked.

## Not changed
- The workflow order, the Quality Head options and the Stores steps
- The rule that unblocking only works after "Accept under deviation"
- Every other screen, print form and email

## Technical details
- Migration: `CREATE POLICY "QH accept-deviation can update SAP status" ON public.mrb_records FOR UPDATE TO authenticated USING (final_decision = 'accept_under_deviation' AND (has_role(auth.uid(),'quality_head') OR has_role(auth.uid(),'quality') OR has_role(auth.uid(),'admin'))) WITH CHECK (same)`. Permissive policies are combined with OR, so the existing policies are unaffected.
- `supabase/functions/sap-sync/handler.ts`: after a successful unblock response, use the service-role client to update `mrb_records` (`sap_stock_update_status='synced'`) by mrb_id. Then redeploy `sap-sync`.
- Data: `UPDATE mrb_records SET sap_stock_update_status='synced' WHERE mrb_number='MRB-2026-0058'`.
- On-premise server: the same migration and function update must be applied there as well.
