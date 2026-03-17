---
name: youtube-transcript
description: Extract a transcript from a YouTube video and generate a summary report with executive summary and top 25 takeaways. Requires the chrome-cdp skill and Chrome with remote debugging enabled. Use when given a YouTube link to summarize, transcribe, or create a report from.
---

# YouTube Transcript & Summary Report

Extracts the full transcript from a YouTube video via Chrome CDP and generates a polished Markdown report with an executive summary and top 25 takeaways.

## Prerequisites

- **Node.js 22+** (uses built-in WebSocket)
- **Chrome** with remote debugging enabled (`chrome://inspect/#remote-debugging` → toggle on)
- **chrome-cdp skill** — installed automatically by the setup script

## Setup

Run once before first use. This checks all dependencies and installs the chrome-cdp skill if missing:

```bash
bash scripts/setup.sh
```

The setup script will:
1. Verify Node.js 22+ is installed
2. Search for the chrome-cdp skill in standard pi locations
3. If not found, install it automatically via `pi install git:github.com/pasky/chrome-cdp-skill`
4. Check that Chrome remote debugging is reachable
5. Print the resolved `cdp.mjs` path for use in subsequent commands

If `pi` CLI is not available, install chrome-cdp manually:
```bash
pi install git:github.com/pasky/chrome-cdp-skill
```

## Workflow

Follow these steps in order:

### Step 1: Resolve the CDP path

The chrome-cdp skill's `cdp.mjs` script is needed by the extraction script. Find it by searching these locations in order:

1. `~/.pi/agent/git/github.com/pasky/chrome-cdp-skill/skills/chrome-cdp/scripts/cdp.mjs` (global pi install)
2. `~/.agents/skills/chrome-cdp/scripts/cdp.mjs` (agents dir)
3. Project-level `.pi/git/` or `.agents/skills/` or `skills/` directories

If not found, run `bash scripts/setup.sh` to install it.

### Step 2: Extract the transcript

Run the extraction script. It finds the YouTube tab in Chrome, opens the transcript panel, and saves cleaned text.

```bash
node scripts/extract-transcript.mjs <cdp-path> <youtube-url> [output-file]
```

**Parameters:**
- `<cdp-path>` — Resolved path to `cdp.mjs` from Step 1
- `<youtube-url>` — Full YouTube video URL (e.g. `https://www.youtube.com/watch?v=XXXXXXXXXXX`)
- `[output-file]` — Where to save the transcript (default: `/tmp/youtube-transcript.txt`)

**Example:**

```bash
node scripts/extract-transcript.mjs \
  ~/.pi/agent/git/github.com/pasky/chrome-cdp-skill/skills/chrome-cdp/scripts/cdp.mjs \
  "https://www.youtube.com/watch?v=n4E4xNYCkYM" \
  /tmp/transcript.txt
```

The script will:
1. List Chrome tabs and find one matching the YouTube URL (or navigate an existing YouTube tab to the URL)
2. Expand the video description
3. Click "Show transcript" to open the transcript panel
4. Extract the full transcript text in chunks
5. Clean it — removing duplicate descriptive timestamps, formatting chapter headers and timestamps
6. Extract video metadata (title, channel name)
7. Write the cleaned transcript to the output file

> **Note:** The YouTube video must be open in a Chrome tab (or any YouTube page that can be navigated). If no YouTube tab exists, the script will error with instructions.

> **Note:** If "Show transcript" is not found, the video may not have captions available.

### Step 3: Read the transcript

Use the `read` tool to load the extracted transcript file. For long transcripts (>2000 lines), read in multiple passes using `offset` and `limit` to get the complete content before writing the report.

### Step 4: Generate the report

Create a Markdown report with the following structure. Use the full transcript content to produce a thorough, accurate report:

```markdown
# [Video Title]

**Source:** [YouTube URL]
**Published:** [Date if visible]
**Speaker(s):** [Names and roles extracted from transcript context]
**Channel:** [Channel name]
**Duration:** [If known]

---

## Executive Summary

Write 3-6 substantive paragraphs that capture:
- The central thesis or theme of the video
- Key arguments and frameworks presented
- Notable data points, metrics, or examples
- The speaker's predictions or forward-looking statements
- Why this content matters — context and implications

The summary should be detailed enough that someone who hasn't watched the video
gets the full picture, but concise enough to read in 2-3 minutes.

---

## Top 25 Takeaways

### 1. [Concise Takeaway Title]
[2-4 sentences expanding on the takeaway with specific details, quotes, or data
from the transcript. Include timestamps or context where relevant.]

### 2. [Concise Takeaway Title]
...

(continue through 25)

---

*Report generated on [date]*
```

**Guidelines for the report:**
- Extract **specific claims, data points, and quotes** — not vague summaries
- Each takeaway should be **self-contained** and informative on its own
- Order takeaways by **importance and impact**, not chronologically
- Use the speaker's actual language and frameworks where possible
- Include **numbers, metrics, and concrete examples** when available
- Distinguish between facts stated and opinions/predictions
- If the video is a conversation, attribute viewpoints to the correct speaker

### Step 5: Save and open the report

Save the report as a Markdown file in the current working directory and open it:

```bash
open /path/to/report.md
```

## Troubleshooting

### "No YouTube tab found"
Open the video URL in Chrome before running the script. Chrome remote debugging must be enabled.

### "Show transcript button not found"
Not all YouTube videos have transcripts. The video needs auto-generated or manually uploaded captions.

### Transcript is incomplete or garbled
The script extracts text in chunks. If a chunk boundary splits mid-sentence, minor artifacts may appear. These are cosmetic and don't affect the report quality.

### Chrome shows "Allow debugging" modal
On first access to a tab, Chrome may ask permission. Approve it, then retry the extraction.

### chrome-cdp skill not found
Run `bash scripts/setup.sh` to auto-install, or manually:
```bash
pi install git:github.com/pasky/chrome-cdp-skill
```
