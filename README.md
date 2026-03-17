# Specteron

The Claude Code Chrome Extension killer.

Specteron is a [pi](https://github.com/badlogic/pi-mono) project with Chrome DevTools Protocol automation, scheduled task execution, and more, with no limits or rules.

## Features

### 🗓️ Task Scheduler

A pi extension that runs scheduled tasks in **background `pi -p` processes** — never interrupting your interactive session.

- **One-time tasks** — run at a specific date (e.g. cancel a subscription in 13 days)
- **Interval tasks** — run on a recurring schedule (e.g. check Gmail every 10 minutes)
- **Background execution** — tasks spawn as separate `pi -p --no-session` processes
- **Task logs** — output captured to `.pi/task-{id}.log`
- **Commands**: `/tasks`, `/tasks-add`, `/tasks-remove`

### 🖥️ Glimpse Widgets

[Glimpse](https://github.com/nicobailon/glimpseui) is a native macOS windowing library that renders HTML/SVG/Canvas content in lightweight WKWebView windows — no Electron, no browser tab. Specteron uses Glimpse (via the [`pi-generative-ui`](https://www.npmjs.com/package/pi-generative-ui) plugin) to display task output as floating desktop widgets: email dashboards, data tables, charts, and any visual content the agent produces. Each widget is a self-contained HTML fragment styled with the [Specteron brand system](.pi/skills/specteron-brand/SKILL.md).

### 🔗 Glimpse Enhancements

Patches to `pi-generative-ui` and its `glimpseui` dependency:

- **External link handling** — links clicked in widgets open in the system browser (or a configured browser app) instead of navigating within the WKWebView
- **`--browser` flag** — configure which browser app opens links (set via `GLIMPSE_BROWSER` env var)
- **`--position` flag** — named window positions: `top-left`, `top-right`, `bottom-left`, `bottom-right`
- **`GLIMPSE_DEFAULT_WIDTH/HEIGHT`** — default widget size, supports `"50%"` for half-screen
- **`GLIMPSE_DEFAULT_POSITION`** — default widget position for all widgets

## Setup

### Prerequisites

- [pi](https://github.com/badlogic/pi-mono) coding agent
- macOS (for Glimpse native widgets)
- Chrome with remote debugging: `/Applications/Chrome Debug.app` (or any Chrome launched with `--remote-debugging-port=9222`)
- Follow this [gist](https://gist.github.com/joemccann/e903f814997d4f56c63142ed86a2143a) to create a custom Chrome instance that avoids the need to approve every remote debugging connection.

### Install pi plugins

```bash
pi install pasky/chrome-cdp-skill
pi install npm:pi-generative-ui
pi install npm:pi-design-deck
pi install npm:pi-side-chat
```

### Apply Glimpse patches

After installing `pi-generative-ui`, apply the patches for link handling and window positioning:

```bash
bash .pi/patches/apply.sh
```

### Environment variables

Add to `~/.zshrc` (or your shell profile):

```bash
# Links in Glimpse widgets open in Chrome Debug
export GLIMPSE_BROWSER="/Applications/Chrome Debug.app"
```

Project-local widget defaults are in `.pi/env` (loaded automatically by the `widget-defaults.ts` extension):

```
GLIMPSE_DEFAULT_WIDTH=50%
GLIMPSE_DEFAULT_HEIGHT=50%
GLIMPSE_DEFAULT_POSITION=top-left
```

## Project Structure

```
.pi/
├── extensions/
│   ├── task-scheduler.ts     # Scheduled task runner (background pi -p processes)
│   └── widget-defaults.ts    # Loads .pi/env for project-local Glimpse defaults
├── patches/
│   ├── apply.sh              # Script to apply Glimpse/generative-ui patches
│   ├── generative-ui-index.ts # Patched generative-ui extension
│   ├── glimpse.swift          # Patched Glimpse Swift source (link handling, --position, --browser)
│   └── glimpse.mjs            # Patched Glimpse JS module
├── env                        # Project-local env vars for widget defaults
├── gmail-seen.json            # Deduplication state for Gmail monitor
├── tasks.json                 # Scheduled tasks definition
└── tasks.schema.json          # JSON schema for tasks.json
```

## Scheduled Tasks

Recurring tasks are defined in `.pi/tasks.json` and documented in [`TASKS.md`](TASKS.md).

## Commands

| Command | Description |
|---------|-------------|
| `/tasks` | List all scheduled tasks with status and countdown |
| `/tasks-add` | Interactively add a new scheduled task |
| `/tasks-remove` | Remove a task by id |

## License

MIT
