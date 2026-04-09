

## Plan: Move "Block Selected" Button Next to "Available Stock" Header

### Change — Single file: `src/pages/ShopFloorStockSelection.tsx`

Move the "Block Selected" button from the sticky top header (line 348–367) into the "Available Stock" card header (line 490), placing it opposite the title on the same row.

**1. Remove "Block Selected" from sticky header** (lines 348–367)
- Delete the conditional block that renders the Block Selected button in the top bar

**2. Add "Block Selected" into the Available Stock card header** (lines 490–497)
- Place the Block Selected button alongside the existing "Proceed to MRB" button, so it sits on the right side opposite the "Available Stock" title
- Keep the same conditional rendering (`selectedStocks.size > 0`), styling, and progress indicator logic

### Result
The "Block Selected" button appears on the same row as "Available Stock", aligned to the right — directly opposite the heading.

