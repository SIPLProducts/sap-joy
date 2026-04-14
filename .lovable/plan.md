

## Improve HTML Email Template Styling

### What's happening now
The `generateHtmlEmail` function in `send-mrb-email/index.ts` does basic text-to-HTML conversion — replacing newlines with `<br/>` tags. This produces a plain wall of text as seen in your screenshot, where numbered sections, key-value pairs, and headings all look the same.

### What we'll change

**Single file:** `supabase/functions/send-mrb-email/index.ts` — rewrite the `generateHtmlEmail` function with smart formatting logic.

### New formatting rules

1. **Numbered sections** (lines starting with `1.`, `2.`, `3.` etc.) → rendered as **cards** with light background (`#f0f4f8`), rounded corners, and a colored left border
2. **Key: Value pairs** (lines containing `:`) → **label** in bold dark color, **value** in normal weight — displayed in a clean two-tone row layout
3. **Greeting lines** ("Dear Material Review Board") → styled as a proper salutation with slightly larger font
4. **Section headings** within cards (e.g., "Defect Overview", "Material & Vendor Details") → bold with a subtle bottom border
5. **MRB Reference badge** in the subject bar → pill-shaped badge with blue background
6. **Action required section** → highlighted with an amber/orange left-border card to draw attention
7. **Sign-off** ("Best regards, Quality Department") → italic, separated styling

### Visual structure (approximate)

```text
┌─────────────────────────────────┐
│  HBL Power Systems (blue bar)   │
├─────────────────────────────────┤
│  Subject   │ MRB-2026-0026 pill │
├─────────────────────────────────┤
│  Dear Material Review Board,    │
│                                 │
│  Intro paragraph text...        │
│                                 │
│  ┌── Card (light bg) ─────────┐│
│  │ 1. Defect Overview          ││
│  │  Total Qty:  0 NOS          ││
│  │  Blocked:    10 NOS         ││
│  │  Primary:    reject         ││
│  └─────────────────────────────┘│
│                                 │
│  ┌── Card (light bg) ─────────┐│
│  │ 2. Material & Vendor       ││
│  │  Material:  1003094256      ││
│  │  Plant:     1300            ││
│  │  Vendor:    2051394         ││
│  └─────────────────────────────┘│
│                                 │
│  ┌── Card (amber border) ─────┐│
│  │ 4. Required Action          ││
│  │  Please review the NCR...   ││
│  └─────────────────────────────┘│
│                                 │
│  Best regards,                  │
│  Quality Department             │
├─────────────────────────────────┤
│  Footer (gray)                  │
└─────────────────────────────────┘
```

### Technical approach
- Parse the body text line-by-line
- Detect numbered sections via regex `/^\d+\.\s/`
- Detect key:value pairs via regex `/^([^:]+):\s*(.+)$/`
- Detect "Required Action" or "Action Required" sections and apply amber styling
- All styling uses inline CSS (required for email client compatibility)
- No changes to any other functionality — only the HTML generation

### Deployment
- Redeploy the `send-mrb-email` edge function after the update

