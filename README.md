# Specteron

A [pi](https://github.com/badlogic/pi-mono) project with Chrome DevTools Protocol automation, scheduled task execution, and Gmail inbox monitoring powered by Gmail's Gemini AI.

## Features

### 🗓️ Task Scheduler

A pi extension that runs scheduled tasks in **background `pi -p` processes** — never interrupting your interactive session.

- **One-time tasks** — run at a specific date (e.g. cancel a subscription in 13 days)
- **Interval tasks** — run on a recurring schedule (e.g. check Gmail every 10 minutes)
- **Background execution** — tasks spawn as separate `pi -p --no-session` processes
- **Task logs** — output captured to `.pi/task-{id}.log`
- **Commands**: `/tasks`, `/tasks-add`, `/tasks-remove`

### 📧 Gmail Inbox Monitor

An interval task that checks Gmail for new unread emails every 10 minutes:

1. Connects to Chrome via CDP (Chrome DevTools Protocol)
2. Scrapes unread emails from Gmail inbox (sender, subject, time, thread links)
3. Queries **Gmail's built-in Gemini AI** ("Ask Gmail") for intelligent per-email summaries
4. Displays results in a native macOS widget (via [Glimpse](https://github.com/nicobailon/glimpseui)):
   - Clickable subject links that open directly in Chrome
   - AI-generated summaries with ✨ Gemini badge
   - Light/dark mode toggle (defaults to OS setting)
   - Only shows **new** emails not seen in prior runs (deduplication via `.pi/gmail-seen.json`)

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
- Gmail account logged in to Chrome

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

## Task Schema

Tasks are defined in `.pi/tasks.json`:

```jsonc
{
  "tasks": [
    {
      "id": "my-task",
      "description": "Natural language instruction for pi to execute",
      "schedule": {
        "type": "date",          // Run once at a specific date
        "date": "2026-04-01T12:00:00.000Z"
      },
      // OR
      "schedule": {
        "type": "interval",      // Run repeatedly
        "intervalMs": 600000     // Every 10 minutes
      },
      "status": "pending",       // pending | running | completed | failed
      "createdAt": "...",
      "lastRunAt": null,
      "completedAt": null
    }
  ]
}
```

## Commands

| Command | Description |
|---------|-------------|
| `/tasks` | List all scheduled tasks with status and countdown |
| `/tasks-add` | Interactively add a new scheduled task |
| `/tasks-remove` | Remove a task by id |

## License

MIT
