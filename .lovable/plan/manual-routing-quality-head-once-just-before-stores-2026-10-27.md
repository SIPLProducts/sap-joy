# Manual Routing: Quality Head once, just before Stores

Change the Manual Routing default order on the 3 MRB creation screens (Inward, In-Process, Shop Floor) to:

```text
[roles you choose...]  ->  Quality Head  ->  Stores
```

- Remove the Quality Head step at the start. Quality Head shows only once.
- Remove the "Second Quality Head" name; it shows as "Quality Head".
- Quality Head and Stores stay ticked and locked by default (marked "(default)"). Stores is always last, with Quality Head right before it.
- Other roles you tick go before Quality Head, and you can reorder them with the arrows.
- Predefined routing, design, emails and SAP calls stay the same.

## Technical details

- `src/lib/manualRoutingDefaults.ts`: `buildManualRouting(middle)` returns `[...middle, 'quality_head', 'stores']`; remove `MANUAL_FIRST`.
- In the 3 pages: remove the "Second Quality Head" label override. Up/down arrows: block the first middle row from moving up only when that would be index 0 (no longer locked), and block moving down into the Quality Head slot (`idx === length - 3`).
- Keep the repeated-role approval counting in `useMRBDatabase` / `workflowRouting`. It does nothing when a role appears only once.
