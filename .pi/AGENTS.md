# Specteron — Project Context

## Known Environment Issues

### Chrome CDP
- Chrome Debug app (`/Applications/Chrome Debug.app`) must be running with `--remote-debugging-port=9222` before any CDP operation. If CDP calls fail, check the process is alive first.
- macOS CDP quirks: consent dialogs and "Chrome is being controlled" banners block automation. Use `Page.javascriptDialogOpening` events or dismiss programmatically before proceeding.
- Page load timing on macOS is less predictable than headless — always wait for `Page.loadEventFired` or poll `document.readyState` rather than using fixed delays.
- Cookie consent popups and overlay modals frequently block element interaction. Detect and dismiss these before attempting clicks or form fills.

### Glimpse / WKWebView
- Glimpse widgets render in WKWebView, not Chrome. CSS behavior differs — test visually, not just in code. Features like `backdrop-filter` and some CSS variable inheritance behave differently.
- After any `pi install` or plugin update, re-run `bash .pi/patches/apply.sh` and verify patches applied cleanly. Upstream updates to `pi-generative-ui` or `glimpseui` may break patches.

### State Files
- `.pi/gmail-seen.json` and `.pi/tasks.json` are read/written by background task processes. Avoid editing these while tasks are running to prevent conflicts.

## Widget Development

- Always verify rendered output visually before committing widget template or brand changes. WKWebView rendering differs from Chrome — do not assume HTML/CSS edits look correct without checking.
- Specify exact expected behavior for any widget change: colors, layout, content format, theme toggle behavior. Do not leave visual output to inference.
- CSS variables: Confirm a variable exists in `brand/brand/specteron-design-tokens.json` before referencing it. Undefined CSS variables silently produce transparent/invisible output.

## Persistent Widgets

The project includes a **widget registry system** for maintaining widgets across pi sessions:

### Architecture
1. **`update_widget` tool** — Creates or updates a persistent widget by title. If a widget with the same title is already open, it updates the content in-place. Otherwise, it spawns a new window that persists after the pi process exits.

2. **Relay process** (`widget-relay.mjs`) — Each persistent widget has a relay that:
   - Spawns Glimpse and keeps the stdin pipe open
   - Listens on a Unix domain socket for update commands
   - Handles `open-url` messages to open links in the default browser

3. **Registry file** (`.pi/widget-registry.json`) — Tracks active widgets with relay PIDs and socket paths.

### External Links
Widgets automatically intercept link clicks and open them in the default browser. The wrapper script:
- Captures click events on `<a href="...">` elements
- Sends `{ type: "open-url", url: href }` via `window.glimpse.send()`
- The relay runs `open <url>` on macOS

### Commands
- `/widgets` — List all active persistent widgets
- `close_widget` tool — Close a widget by title

### Usage in Scheduled Tasks
For tasks that display widgets (e.g., `gmail-inbox-monitor`, `linkedin-inbox-cleaner`):
1. Use `update_widget` instead of `show_widget`
2. The widget updates in-place on subsequent runs
3. Links open in the default browser when clicked
4. Widget window stays open after task completes

## TypeScript Extensions

Extensions in `.pi/extensions/`:
- `task-scheduler.ts` — Scheduled task execution with background `pi -p` processes
- `widget-defaults.ts` — Project-local Glimpse widget positioning defaults
- `widget-registry.ts` — Persistent widget management across sessions

Patched sources live in `.pi/patches/`. When modifying extensions, run `npx tsc --noEmit` to catch type errors before committing.

## Tasks

Recurring tasks that run automatically via the [task scheduler](.pi/extensions/task-scheduler.ts). Defined in [`.pi/tasks.json`](.pi/tasks.json).

- Task descriptions in `.pi/tasks.json` are injected as user messages to `pi -p` background processes. Write them as clear, step-by-step instructions.
- Task logs go to `.pi/task-{id}.log` — check these for debugging failed tasks rather than re-running interactively.
- Always call `complete_task` with the task ID at the end of task execution.

### LinkedIn Task Notes
- **Thread URLs are not in the DOM** — Click each conversation and capture `window.location.href` after the URL updates
- **URL format** — `https://www.linkedin.com/messaging/thread/2-{base64-encoded-id}/`
- **Unread detection** — Use the "Unread" filter button

## Brand System Enforcement

**Every time you generate visual output in this project, you MUST load and follow the Specteron brand skill first.**

Before creating any `show_widget`, `update_widget`, `design_deck`, HTML, SVG, CSS, chart, diagram, or UI mockup:
1. Read `.pi/skills/specteron-brand/SKILL.md` for the complete design system
2. Apply all color tokens, typography, spacing, and component rules exactly
3. Reference `brand/brand/specteron-design-tokens.json` for machine-readable tokens

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
brand/
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
