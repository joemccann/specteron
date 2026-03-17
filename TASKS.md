# Scheduled Tasks

Recurring tasks that run automatically via the [task scheduler](.pi/extensions/task-scheduler.ts). Defined in [`.pi/tasks.json`](.pi/tasks.json).

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
