## Change Yellowish Colors to Blueish

### Scope
Swap all yellow-tinted semantic tokens in `src/index.css` to blue equivalents. No component or layout changes — existing `bg-accent`, `text-warning`, `bg-sla-yellow` etc. classes will automatically pick up the new hues.

### Tokens to Update
| Token | Current | New |
|-------|---------|-----|
| `--accent` | 45 84% 62% (yellow) | 210 100% 56% (#1E90FF blue) |
| `--accent-foreground` | dark | white (blue is darker, needs light text) |
| `--warning` | 36 100% 50% (orange) | 210 90% 50% (medium blue) |
| `--sla-yellow` | 45 84% 50% (yellow) | 210 80% 55% (blue) |
| Dark `--accent` | 45 84% 62% | 210 100% 56% |

### What Stays the Same
- `--primary` (Amazon orange) unchanged
- `--secondary` (teal) unchanged
- `--destructive` (red) unchanged
- `--success` (green) unchanged
- `--info` (teal) unchanged
- Sidebar navy background unchanged
- All component logic, flows, and functionality untouched

### Verification
- Preview login page, dashboard, worklist — accents, badges, and highlights should render in blue instead of yellow.
- No console errors or broken styles.