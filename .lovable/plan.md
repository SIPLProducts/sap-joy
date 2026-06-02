## Replace Orange Primary with Blue

The yellowish/orange look on login (hero gradient, Sign In button) and across the app (MRB number badges, dropdown highlights, focus rings, sidebar active item) all come from `--primary: 36 100% 50%` (#FF9900) in `src/index.css`. Swap this orange token to a strong blue — every `bg-primary`, `text-primary`, `from-primary`, `ring-primary`, and sidebar active accent updates automatically.

### Token changes in `src/index.css`

| Token | Current | New |
|-------|---------|-----|
| `--primary` (light) | 36 100% 50% (orange) | 211 100% 45% (#0066E6 blue) |
| `--primary-foreground` (light) | dark | white |
| `--primary` (dark) | 36 100% 50% | 211 100% 55% |
| `--primary-foreground` (dark) | dark | white |
| `--sidebar-primary` (light + dark) | orange | 211 100% 55% blue |
| `--sidebar-ring` (light + dark) | orange | 211 100% 55% blue |
| `--ring` (dark) | orange | 211 100% 55% blue |
| `--chart-1` | orange | 211 100% 45% blue |
| `bg-amber-500` on Login health dot (line 364) | amber | `bg-primary` (now blue) |

### What stays
- Secondary teal, success green, destructive red, sidebar navy background — unchanged
- All component logic, layouts, flows — untouched
- Hero `loginHeroImage` jpg is overlaid by `from-primary/90 via-primary/70` gradient, so changing `--primary` turns the hero blue without touching the image asset

### Verification
- Login page: hero gradient and Sign In button render blue
- App shell: sidebar active item, MRB number links, dropdown focus rings render blue
- No yellow/orange remains except intentional warnings if any