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

## TypeScript Extensions

The project has TS extensions in `.pi/extensions/` (`task-scheduler.ts`, `widget-defaults.ts`) and patched sources in `.pi/patches/`. When modifying these, run `npx tsc --noEmit` to catch type errors before committing.

## Task Scheduler

- Task descriptions in `.pi/tasks.json` are injected as user messages to `pi -p` background processes. Write them as clear, step-by-step instructions.
- Task logs go to `.pi/task-{id}.log` — check these for debugging failed tasks rather than re-running interactively.
- Always call `complete_task` with the task ID at the end of task execution.
