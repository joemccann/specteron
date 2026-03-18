# Specteron

Chrome CDP automation, scheduled tasks, and Glimpse native widgets powered by [pi](https://github.com/badlogic/pi-mono).

## Known Environment Issues

### Chrome CDP
- Chrome Debug app (`/Applications/Chrome Debug.app`) must be running with `--remote-debugging-port=9222` before any CDP operation. If CDP calls fail, check the process is alive first.
- macOS CDP has unique quirks: consent dialogs and "Chrome is being controlled" banners can block automation. Use `Page.javascriptDialogOpening` events or dismiss programmatically before proceeding.
- Page load timing on macOS is less predictable than headless — always wait for `Page.loadEventFired` or poll `document.readyState` rather than using fixed delays.
- Cookie consent popups and overlay modals frequently block element interaction. Detect and dismiss these before attempting clicks or form fills.

### Glimpse / WKWebView
- Glimpse widgets render in WKWebView, not Chrome. CSS behavior differs — test visually, not just in code. Features like `backdrop-filter` and some CSS variable inheritance behave differently.
- After any `pi install` or plugin update, re-run `bash .pi/patches/apply.sh` and verify patches applied cleanly. Upstream updates to `pi-generative-ui` or `glimpseui` may break patches.

### SQLite / State Files
- `.pi/gmail-seen.json` and `.pi/tasks.json` are read/written by background task processes. Avoid editing these while tasks are running to prevent conflicts.

## Widget Development

- **Always verify rendered output visually** before committing widget template or brand changes. Don't assume HTML/CSS edits look correct — WKWebView rendering differs from Chrome.
- **Specify exact expected behavior** for any widget change: colors, layout, content format, theme toggle behavior. Don't leave visual output to inference.
- **Every widget must have a dark/light theme toggle** — this is mandatory per the brand system. No exceptions.
- **CSS variables**: Confirm a variable exists in `brand/brand/specteron-design-tokens.json` before referencing it. Undefined CSS variables silently produce transparent/invisible output.
- **No box-shadow, no glassmorphism, no consumer rounding, no emojis** in widget UI.

## Persistent Widgets

The project includes a **widget registry system** (`.pi/extensions/widget-registry.ts`) that maintains widgets across pi sessions:

### How It Works
1. **`update_widget` tool** — Creates or updates a persistent widget by title. If a widget with the same title is already open, it updates the content in-place. Otherwise, it spawns a new window that persists after the pi process exits.

2. **Relay process** — Each persistent widget has a relay process (`widget-relay.mjs`) that:
   - Spawns Glimpse and keeps the stdin pipe open
   - Listens on a Unix domain socket for update commands
   - Handles `open-url` messages to open links in the default browser

3. **Registry file** (`.pi/widget-registry.json`) — Tracks active widgets with their relay PIDs and socket paths.

### External Links in Widgets
Widgets automatically intercept link clicks and open them in the default browser via the relay process. The HTML wrapper includes a script that:
- Captures click events on `<a href="...">` elements
- Sends `{ type: "open-url", url: href }` via `window.glimpse.send()`
- The relay receives this and runs `open <url>` on macOS

### Commands
- `/widgets` — List all active persistent widgets
- `close_widget` tool — Close a widget by title

### Usage in Tasks
For scheduled tasks that display widgets (like `gmail-inbox-monitor` or `linkedin-inbox-cleaner`):
1. Use `update_widget` instead of `show_widget`
2. The widget will update in-place on subsequent runs
3. Links will open in the default browser when clicked

## TypeScript Extensions

The project has TS extensions in `.pi/extensions/`:
- `task-scheduler.ts` — Scheduled task execution with background `pi -p` processes
- `widget-defaults.ts` — Project-local Glimpse widget positioning defaults
- `widget-registry.ts` — Persistent widget management across sessions

Patched sources live in `.pi/patches/`. When modifying extensions, run `npx tsc --noEmit` to catch type errors before committing.

## Task Scheduler

- Task descriptions in `.pi/tasks.json` are injected as user messages to `pi -p` background processes. Write them as clear, step-by-step instructions.
- Task logs go to `.pi/task-{id}.log` — check these for debugging failed tasks rather than re-running interactively.
- Always call `complete_task` with the task ID at the end of task execution.

## LinkedIn Task Notes

The LinkedIn inbox cleaner task requires special handling:
- **Thread URLs are not in the DOM** — You must click each conversation and capture `window.location.href` after the URL updates
- **Unread detection** — Use the "Unread" filter button or look for specific unread indicator classes
- **URL format** — LinkedIn thread URLs are `https://www.linkedin.com/messaging/thread/2-{base64-encoded-id}/`
