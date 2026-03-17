# Gen UI — Project Context

## Brand System Enforcement

**Every time you generate visual output in this project, you MUST load and follow the Gen UI brand skill first.**

Before creating any `show_widget`, `design_deck`, HTML, SVG, CSS, chart, diagram, or UI mockup:
1. Read `.pi/skills/gen-ui-brand/SKILL.md` for the complete design system
2. Apply all color tokens, typography, spacing, and component rules exactly
3. Reference `brand-guidelines/brand/gen-ui-design-tokens.json` for machine-readable tokens

### Quick Reference (always in effect)

- **Flagship accent:** `#05AD98` (teal — institutional, not consumer)
- **Dark background:** `#0a0f14` canvas, `#0f1519` panels
- **Borders:** `1px solid #1e293b` — hairline, no shadows
- **Border radius:** 4px max (999px for capsule badges only)
- **Fonts:** Inter (UI), IBM Plex Mono (numbers/telemetry), Söhne (display)
- **No box-shadow, no glassmorphism, no consumer rounding, no emojis in UI**
- **Signal colors are semantic** — teal = clarity, magenta/violet = dislocation, amber = caution, red = fault
- **Voice:** precise, calm, scientific, unsensational

### Brand Assets Location
```
brand-guidelines/
├── brand/
│   ├── gen-ui-brand-system.md          # Full specification (9 sections)
│   ├── gen-ui-design-tokens.json       # Machine-readable tokens
│   ├── gen-ui-tailwind-theme.ts        # Tailwind theme extension
│   ├── gen-ui-component-kit.html       # Live component reference
│   ├── gen-ui-terminal-mockup.html     # Terminal layout mockup
│   ├── gen-ui-app-icon.svg             # App icon
│   ├── gen-ui-monogram.svg             # Monogram
│   ├── gen-ui-wordmark.svg             # Wordmark
│   └── gen-ui-lockup-horizontal.svg    # Horizontal lockup
├── docs/
│   └── brand-identity.md               # Design system reference
└── web/                                # React components & CSS
```
