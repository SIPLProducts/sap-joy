## Apply Amazon UI Color Palette (tokens-only)

Re-skin the app using Amazon's brand colors by updating semantic design tokens in `src/index.css`. No layout, component, or functionality changes — every page, button, dropdown, table, sidebar, dialog, and chart will automatically pick up the new colors via existing `bg-primary`, `text-foreground`, `bg-sidebar`, etc. classes.

### Amazon palette mapping

| Token | New value | Amazon usage |
|---|---|---|
| `--primary` | Amazon orange `#FF9900` (hsl `36 100% 50%`) | CTA buttons, links, focus ring |
| `--primary-foreground` | `#0F1111` (hsl `0 0% 7%`) | Text on orange |
| `--secondary` | Amazon link blue `#007185` (hsl `189 100% 26%`) | Secondary buttons, info accents |
| `--accent` | Soft yellow `#F0C14B` (hsl `45 84% 62%`) | Highlights, badges |
| `--background` | Amazon surface `#EAEDED` (hsl `180 5% 92%`) | Page background |
| `--foreground` | Amazon text `#0F1111` (hsl `0 0% 7%`) | Body text |
| `--card` / `--popover` | `#FFFFFF` | Cards, dialogs, dropdowns |
| `--muted` | `#F7F8F8` (hsl `180 8% 97%`) | Subtle surfaces |
| `--muted-foreground` | `#565959` (hsl `180 1% 35%`) | Helper text |
| `--border` / `--input` | `#D5D9D9` (hsl `180 4% 84%`) | Field/table borders |
| `--ring` | Amazon focus `#C8F3FA` outline base `#007185` | Focus ring |
| `--destructive` | `#B12704` (hsl `13 96% 35%`) — Amazon price red | Errors, delete |
| `--success` | `#067D62` (hsl `170 90% 26%`) — Amazon "In Stock" green | Success |
| `--warning` | `#F0C14B` | Warnings |
| **Sidebar** | `--sidebar-background` `#131A22` (hsl `212 26% 11%`), `--sidebar-foreground` `#FFFFFF`, `--sidebar-accent` `#232F3E` (hsl `212 26% 19%`), `--sidebar-primary` `#FF9900` | Amazon dark navy nav |
| **Chart palette** | orange, navy, link blue, success green, price red | Recharts |

Dark mode tokens get equivalents (deep navy bg, orange primary stays, etc.).

### Files to change

- `src/index.css` — replace the `:root` and `.dark` token values with the table above. Keep all token names and structure intact.

### Out of scope (preserves functionality)

- No JSX, component logic, routing, hooks, contexts, or data flow changes.
- No font size / spacing / radius / typography changes.
- `tailwind.config.ts` color mappings stay as-is (already reference these CSS vars).
- Status badge helpers (`getStatusColor`, `getSLAColor`) continue to work since `--success`, `--warning`, `--destructive`, and SLA tokens are remapped to Amazon equivalents.

### Verification after build

1. Login, dashboard, worklist, MRB detail, inward report — all render with Amazon look.
2. Primary buttons are Amazon orange with dark text.
3. Sidebar is dark navy with white text and orange active highlight.
4. Tables, dropdowns, dialogs remain readable; destructive/success badges still distinguishable.