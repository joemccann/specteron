# Scheduled Tasks

Recurring tasks that run automatically via the [task scheduler](.pi/extensions/task-scheduler.ts). Defined in [`.pi/tasks.json`](.pi/tasks.json).

## Adding a New Task

You can add tasks two ways: with the `/tasks-add` command interactively, or by editing `.pi/tasks.json` directly.

### Schema

Every task has these fields:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | yes | Unique identifier (kebab-case) |
| `description` | string | yes | Natural language instruction for pi to execute |
| `schedule` | object | yes | When and how often the task runs (see below) |
| `status` | string | yes | `pending` / `running` / `completed` / `failed` |
| `createdAt` | ISO 8601 | yes | When the task was created |
| `lastRunAt` | ISO 8601 or null | no | When the task last ran |
| `completedAt` | ISO 8601 or null | no | When the task completed (one-time tasks only) |

### Recurring Task

Runs repeatedly on a fixed interval. The scheduler fires the task when `now - lastRunAt >= intervalMs` (or immediately on first run if `lastRunAt` is null).

```json
{
  "id": "my-recurring-task",
  "description": "Check the weather forecast and display it in a Specteron-branded widget.",
  "schedule": {
    "type": "interval",
    "intervalMs": 3600000
  },
  "status": "pending",
  "createdAt": "2026-03-17T12:00:00.000Z",
  "lastRunAt": null,
  "completedAt": null
}
```

Common intervals: `600000` (10 min), `3600000` (1 hour), `86400000` (24 hours).

An optional `startAfter` field (ISO 8601) delays the first run until after that date.

### One-Time Task

Runs once at or after the specified date, then moves to `completed` status.

```json
{
  "id": "cancel-subscription",
  "description": "Navigate to the account page and cancel the monthly subscription.",
  "schedule": {
    "type": "date",
    "date": "2026-04-01T12:00:00.000Z"
  },
  "status": "pending",
  "createdAt": "2026-03-17T12:00:00.000Z",
  "lastRunAt": null,
  "completedAt": null
}
```

### Guidelines

- **Description** is injected as a user message to pi — write it as a clear, step-by-step instruction.
- Tasks run in **background `pi -p` processes** (non-interactive). They have access to all tools and extensions.
- Task output is logged to `.pi/task-{id}.log`.
- Tasks that produce widgets should follow the [Specteron brand system](.pi/skills/specteron-brand/SKILL.md).
- Call `complete_task` with the task `id` at the end of every task execution so the scheduler can track state correctly.

---

## Active Tasks

---

## Gmail Inbox Monitor

| Property | Value |
|----------|-------|
| ID | `gmail-inbox-monitor` |
| Schedule | Every 10 minutes |
| Output | Native widget (`gmail_inbox`, 1200×800, floating) |

Checks Gmail for new unread emails using Chrome CDP and Gmail's built-in Gemini AI.

**Flow:**
1. Connect to Chrome via CDP (remote debugging port 9222)
2. Navigate to Gmail inbox, extract unread emails (sender, subject, time, thread ID)
3. Filter out previously seen emails (deduplication via `.pi/gmail-seen.json`)
4. Query Gmail's Gemini AI ("Ask Gmail") for per-email summaries
5. Parse and match AI summaries to individual emails
6. Display results in a Specteron-branded widget with clickable thread links

**Widget features:**
- Dark/light theme toggle (Specteron brand system, persists in `localStorage`)
- Clickable subject links open directly in Chrome
- AI-generated summaries per email
- Instrument panel styling with Inter + IBM Plex Mono typography

---

## LinkedIn Inbox Cleaner

| Property | Value |
|----------|-------|
| ID | `linkedin-inbox-cleaner` |
| Schedule | Every 24 hours |
| Output | Native widget (Specteron-branded table) |

Scans LinkedIn messaging inbox, triages messages, and surfaces only the ones worth reading.

**Flow:**
1. Open LinkedIn messaging via Chrome CDP
2. Scroll the conversation list to load all messages
3. Open each message, capture its URL and content
4. Classify: if the message is a sales pitch or generic outreach, mark it as read and skip
5. If the message is substantive, capture the sender name, message summary, and URL
6. Display actionable messages in a Specteron-branded table widget
