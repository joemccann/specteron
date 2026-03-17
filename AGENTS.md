# Specteron — Project Context

## Brand System Enforcement

**Every time you generate visual output in this project, you MUST load and follow the Specteron brand skill first.**

Before creating any `show_widget`, `design_deck`, HTML, SVG, CSS, chart, diagram, or UI mockup:
1. Read `.pi/skills/specteron-brand/SKILL.md` for the complete design system
2. Apply all color tokens, typography, spacing, and component rules exactly
3. Reference `brand-guidelines/brand/specteron-design-tokens.json` for machine-readable tokens

### Quick Reference (always in effect)

- **MANDATORY: Every widget MUST have a dark/light theme toggle** — defaults to OS preference, persists in localStorage key `specteron-theme`, uses `[data-theme]` CSS selectors. No widget ships without it. See Section 0 of the brand skill.
- **Flagship accent:** `#05AD98` (teal — institutional, not consumer)
- **Dark background:** `#0a0f14` canvas, `#0f1519` panels
- **Light background:** `#FFFFFF` canvas, `#FFFFFF` panels, `#F1F5F9` hover
- **Borders:** `1px solid #1e293b` (dark) / `1px solid #BBBFBF` (light) — hairline, no shadows
- **Border radius:** 4px max (999px for capsule badges only)
- **Fonts:** Inter (UI), IBM Plex Mono (numbers/telemetry), Söhne (display)
- **No box-shadow, no glassmorphism, no consumer rounding, no emojis in UI**
- **Signal colors are semantic** — teal = clarity, magenta/violet = dislocation, amber = caution, red = fault
- **Voice:** precise, calm, scientific, unsensational

### Brand Assets Location
```
brand-guidelines/
├── brand/
│   ├── specteron-brand-system.md          # Full specification (9 sections)
│   ├── specteron-design-tokens.json       # Machine-readable tokens
│   ├── specteron-tailwind-theme.ts        # Tailwind theme extension
│   ├── specteron-component-kit.html       # Live component reference
│   ├── specteron-terminal-mockup.html     # Terminal layout mockup
│   ├── specteron-app-icon.svg             # App icon
│   ├── specteron-monogram.svg             # Monogram
│   ├── specteron-wordmark.svg             # Wordmark
│   └── specteron-lockup-horizontal.svg    # Horizontal lockup
├── docs/
│   └── brand-identity.md               # Design system reference
└── web/                                # React components & CSS
```
