---
name: gen-ui-brand
description: Enforces the Gen UI brand system on all visual output — widgets, charts, diagrams, HTML, SVG, CSS, mockups, and any UI generation. Automatically loaded whenever visual content is created. Covers color tokens, typography, spacing, panel structure, signal semantics, brand voice, and motifs.
---

# Gen UI Brand System — Enforcement Skill

**This skill MUST be followed any time you generate visual output** including but not limited to:
- `show_widget` calls (HTML/SVG/Canvas)
- `design_deck` previews (previewHtml, previewBlocks)
- Generated HTML, CSS, SVG, or image prompts
- Chart.js / D3 / Canvas visualizations
- Mermaid diagrams
- UI mockups or prototypes
- Any code that renders to a screen

The full brand specification lives in `brand-guidelines/brand/gen-ui-brand-system.md`.
Design tokens live in `brand-guidelines/brand/gen-ui-design-tokens.json`.

---

## 1. Color System — The Gen UI Spectrum

### Dark Theme (Primary — always use unless user requests light)

| Token | Hex | Use |
|-------|-----|-----|
| `bg.canvas` | `#0a0f14` | Page / window background |
| `bg.panel` | `#0f1519` | Panel / card background |
| `bg.panelRaised` | `#151c22` | Hover / focus / raised panels |
| `line.grid` | `#1e293b` | Borders, dividers, grid lines |
| `line.focus` | `#05AD98` | Focus rings, active borders |
| `text.primary` | `#e2e8f0` | Primary text |
| `text.secondary` | `#94a3b8` | Secondary text |
| `text.muted` | `#475569` | Meta, labels, supporting text |
| `signal.core` | `#05AD98` | **Flagship accent — core discovery, primary action** |
| `signal.strong` | `#0FCFB5` | High-confidence signal |
| `signal.deep` | `#048A7A` | Deep data, selected states |
| `warn` | `#F5A623` | Quality concern, caution |
| `fault` | `#E85D6C` | Feed fault, error, integrity problem |
| `violet.extreme` | `#8B5CF6` | Extreme dislocation, rare state |
| `magenta.dislocation` | `#D946A8` | Structural dislocation |
| `neutral` | `#94a3b8` | Neutral comparative states |

### Light Theme (Only when explicitly requested)

| Token | Hex |
|-------|-----|
| `bg.canvas` | `#FFFFFF` |
| `bg.panel` | `#FFFFFF` |
| `bg.panelRaised` | `#F1F5F9` |
| `line.grid` | `#BBBFBF` |
| `text.primary` | `#000000` |
| `text.secondary` | `#636363` |
| `text.muted` | `#878787` |
| `signal.core` | `#05AD98` |
| `signal.strong` | `#048A7A` |
| `signal.deep` | `#037066` |
| `fault` | `#D4183D` |
| `dislocation` | `#C026A0` |
| `extreme` | `#7C3AED` |
| `neutral` | `#878787` |

### Signal Semantics (clarity scale, NOT profit/loss)

| State | Color | Meaning |
|-------|-------|---------|
| Baseline | `#94a3b8` | No notable structure isolated |
| Emerging | `#048A7A` | Weak but non-random candidate |
| Clear | `#05AD98` | Strong structural candidate |
| Strong | `#0FCFB5` | High-confidence reconstruction |
| Dislocated | `#D946A8` | Structure notably out of line |
| Extreme | `#8B5CF6` | Rare regime / high-convexity event |

### Color Rules
- **NEVER** use generic green/red for profit/loss. Use the signal clarity scale.
- **NEVER** use consumer fintech neons, sci-fi cyan, or bright blue accents.
- `#05AD98` is the flagship accent. Use it for primary actions, core signals, focus states.
- Teal family = clarity/structure. Magenta/Violet = tension/dislocation. Amber = caution. Red = operational fault.
- Chart backgrounds use `bg.canvas` or `bg.panel`. Grid lines use `line.grid` at low opacity.

---

## 2. Typography

### Font Stack
- **UI text:** `Inter, ui-sans-serif, system-ui, sans-serif`
- **Numeric / telemetry / mono:** `'IBM Plex Mono', ui-monospace, SFMono-Regular, monospace`
- **Display / brand moments:** `Söhne, Inter, ui-sans-serif, system-ui, sans-serif`

### Type Scale

| Use | Font | Size | Weight | Tracking | Leading |
|-----|------|------|--------|----------|---------|
| View title | Inter | 18px | 600 | 0.01em | 1.2 |
| Panel title | Inter | 14px | 600 | 0.02em | 1.2 |
| Section label | Inter | 12px | 600 | 0.04em | 1.2 |
| Metric value | Inter | 24–32px | 500/600 | 0 | 1.05 |
| Dense numeric table | IBM Plex Mono | 12–13px | 500 | 0.01em | 1.35 |
| Status / meta | IBM Plex Mono | 11–12px | 400/500 | 0.03em | 1.35 |
| Annotation | Inter | 12px | 400 | 0.01em | 1.4 |

### Typography Rules
- Numbers and telemetry ALWAYS use mono font.
- Labels and metadata should feel like instrument telemetry: uppercase, wide tracking, muted color.
- Avoid excessive weight contrast. Use structure, not bold text, for hierarchy.
- Status fields pattern: `font-family: 'IBM Plex Mono'; font-size: 11px; text-transform: uppercase; letter-spacing: 0.03em; color: #475569;`

### Required Font Imports
Always include in generated HTML:
```html
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;700&display=swap" rel="stylesheet">
```

---

## 3. Spacing & Grid

| Property | Value |
|----------|-------|
| Base unit | 8px |
| Micro unit | 4px |
| Panel padding | 16px (compact: 12px) |
| Section gap | 32px |
| Horizontal gutter | 16px |
| Vertical rhythm | 16px |
| Dense table row | 28px |
| Standard table row | 32px |
| Header row height | 32px |
| Metadata rail height | 20–24px |

---

## 4. Container System — Instrument Panels

Every container/card/section MUST follow the instrument panel spec:

| Property | Value |
|----------|-------|
| Background | `#0f1519` |
| Border | `1px solid #1e293b` |
| Border radius | **4px maximum** |
| Shadow | **None — never use box-shadow** |
| Padding | 16px |
| Header | 32px fixed height, panel ID + module name style |
| Hover | Background shift to `#151c22`, NO lift/scale/shadow |

### Panel Rules
- Use **hairline borders**, never soft shadows or glassmorphism.
- **Matte panel surfaces** with internal grid discipline.
- Panel headers read like device labels (uppercase mono, wide tracking).
- Corners are **tight** (4px max). No consumer rounding (8px+).
- Modules should feel **mountable** — like rack instruments.
- Badges use `border-radius: 999px` (capsule shape) — the only exception to the 4px rule.

---

## 5. Component Patterns

### Signal Badge
```css
height: 20px;
font-family: 'IBM Plex Mono';
font-size: 11px;
font-weight: 500;
border-radius: 999px;
padding: 0 8px;
/* Color driven by signal state */
```

### Tables
- Header: `Inter 11–12px 600, uppercase, letter-spacing: 0.1em, color: #475569`
- Cells: `IBM Plex Mono 12–13px 500`
- Row height: 28–32px
- Row hover: subtle background fill only
- Dividers: `1px solid #1e293b`
- Decimals: right-aligned. Labels: left-aligned.
- No playful sort animations.

### Charts (Chart.js / Canvas / D3)
- Background: `#0a0f14` or `#0f1519`
- Grid lines: `rgba(148, 163, 184, 0.16)` — `#1e293b` for axes
- Primary series: `#05AD98`
- Secondary series: `rgba(148, 163, 184, 0.72)`
- Fill gradients: `rgba(5, 173, 152, 0.22)` → `rgba(5, 173, 152, 0.02)`
- Tooltip: `background: #0f1519; border: 1px solid #1e293b;`
- Axis labels: `IBM Plex Mono 10px, color: #475569`
- Legend: `IBM Plex Mono 11px, uppercase, letter-spacing: 0.08em`

### Loading States
- Data fetching: slow scan line or spectral pulse
- Reconstructing: projection geometry sweep
- Waiting: standby pulse with muted telemetry
- Fault: static panel with explicit reason

---

## 6. Instrument Motifs

Use sparingly in backgrounds, loading states, and transitions:

| Motif | Description | When |
|-------|-------------|------|
| Spectral decomposition lines | Parallel emission-like lines | Loading, decomposition views |
| Circular scanning arcs | Radar/detector rings | Discovery, scan progress |
| Projection geometry | Angled projection lines | Hero backgrounds, regime views |

Rules:
- Keep opacity LOW — structural, not decorative.
- Never compromise data readability.
- Motion: slow, analytical, confidence-increasing. Never flashy.

---

## 7. Brand Voice (for any generated text/labels/messages)

**Voice:** precise, calm, scientific, unsensational, informative under stress.

### Do / Don't

| Never say | Say instead |
|-----------|-------------|
| Massive trade alert! | Structural event detected. |
| Huge gamma squeeze incoming | Convexity concentration elevated. |
| This ticker is exploding | Volatility state shifted beyond baseline range. |
| Something went wrong | Data reconstruction failed. Source feed incomplete. |

### Rules
- Prefer nouns and verbs over adjectives.
- No emotional punctuation.
- **Never use emojis** in generated UI.
- Avoid "huge," "massive," "crazy," "exploding," "insane."
- Error pattern: `[System] + [Failure] + [Cause if known] + [Recovery guidance]`

---

## 8. CSS Variable Template

When generating HTML widgets, always include this CSS variable block for the dark theme:

```css
:root {
  --bg-base: #0a0f14;
  --bg-panel: #0f1519;
  --bg-hover: #151c22;
  --border-dim: #1e293b;
  --border-focus: #05AD98;
  --text-primary: #e2e8f0;
  --text-secondary: #94a3b8;
  --text-muted: #475569;
  --accent: #05AD98;
  --signal-core: #05AD98;
  --signal-strong: #0FCFB5;
  --signal-deep: #048A7A;
  --positive: #05AD98;
  --negative: #E85D6C;
  --warn: #F5A623;
  --fault: #E85D6C;
  --dislocation: #D946A8;
  --extreme: #8B5CF6;
  --neutral: #94a3b8;
  --font-sans: 'Inter', ui-sans-serif, system-ui, sans-serif;
  --font-mono: 'IBM Plex Mono', ui-monospace, SFMono-Regular, monospace;
}
```

---

## 9. Absolute Prohibitions

When generating any visual output, **NEVER**:

1. Use `box-shadow` on panels or cards
2. Use `border-radius` greater than `4px` (except `999px` capsule badges)
3. Use glassmorphism, blur, or frosted glass effects
4. Use gradients for decorative purposes (only for subtle chart fills)
5. Use generic green (#22c55e) / red (#ef4444) for profit/loss
6. Use bright blue (#3b82f6), cyan (#06b6d4), or other non-palette colors
7. Use emojis in UI text
8. Use consumer-style rounded corners (8px+)
9. Use lift/scale hover effects
10. Use fonts outside the approved stack (Inter, IBM Plex Mono, Söhne)
11. Use casual, hypey, or emotional language in labels or messages
12. Center-align dense data; keep left-aligned labels and right-aligned numbers
