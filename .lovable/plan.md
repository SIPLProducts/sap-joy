# Shop Floor MRB: save and show Total Quantity correctly

Only the Shop Floor "Material Blocking & MRB Creation" screen changes. Nothing else is touched.

## Changes
1. **Saving the MRB:** Total Quantity is saved as the full stock from SAP (e.g. 860). Block Quantity stays as typed (e.g. 120). Today both are saved as 120.
2. **Form label:** "Available Quantity" is renamed "Total Quantity". The value stays the same.
3. **Confirmation screen:** shows "Total Quantity: 860 NOS" next to the existing "Block Quantity: 120 NOS". The confirmation printout gets the same extra line.

## Please note
- Only new Shop Floor MRBs are affected. Older ones keep the values they were saved with.
- On the print form, Received QTY will now show the full stock (860). Under your current rule, Rejected QTY = Received − Accepted. So if 120 is unblocked, Rejected would show 740. Tell me if Received should be the blocked quantity instead.

## Technical details
- `src/pages/ShopFloorMaterialBlocking.tsx`: `total_quantity: stockItem.availableQuantity ?? blockQuantity`; relabel the field at line ~605; add a Total Quantity item in the confirmation block (~line 490) and in the HTML print (~line 397).
