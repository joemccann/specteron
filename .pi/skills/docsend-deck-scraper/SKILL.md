---
name: docsend-deck-scraper
description: Scrape a DocSend deck to PDF and interactive viewer. Takes a DocSend URL (must be authenticated in Chrome), screenshots every page, compiles them into a PDF, and displays a carousel widget. Usage: /skill:docsend-deck-scraper <url>
---

# DocSend Deck Scraper

Scrapes all pages of a DocSend presentation, compiles them into a PDF, and displays an interactive slide viewer widget.

## Prerequisites

- Chrome Debug running with remote debugging on port 9222
- DocSend URL must already be authenticated (logged in / passcode entered in Chrome)
- The chrome-cdp skill must be available

## Usage

```
/skill:docsend-deck-scraper https://docsend.com/view/abc123xyz
```

## Workflow

When invoked with a DocSend URL, follow these steps:

### 1. Find or Open the DocSend Tab

```bash
/Users/joemccann/.pi/agent/git/github.com/pasky/chrome-cdp-skill/skills/chrome-cdp/scripts/cdp.mjs list
```

Look for a tab with URL containing `docsend.com/view/`. If found, use its target ID. If not found, navigate an existing tab to the provided URL:

```bash
/Users/joemccann/.pi/agent/git/github.com/pasky/chrome-cdp-skill/skills/chrome-cdp/scripts/cdp.mjs nav <target> <docsend-url>
```

Wait 3 seconds for the page to fully load.

### 2. Check Authentication

Run this eval to detect if authentication is required:

```bash
/Users/joemccann/.pi/agent/git/github.com/pasky/chrome-cdp-skill/skills/chrome-cdp/scripts/cdp.mjs eval <target> "
  var authForm = document.querySelector('input[type=\"email\"], input[type=\"password\"], input[name=\"passcode\"], form[action*=\"auth\"], [data-testid=\"email-input\"]');
  var loginText = document.body.innerText.toLowerCase();
  var needsAuth = authForm !== null || loginText.includes('enter your email') || loginText.includes('enter passcode') || loginText.includes('verify your identity');
  JSON.stringify({ needsAuth: needsAuth });
"
```

If `needsAuth` is `true`, **STOP** and tell the user:

> **Authentication required.** Please log in or enter the passcode for this DocSend link in Chrome, then run this command again.

### 3. Get Total Page Count

Extract the page count from the "X / Y" indicator:

```bash
/Users/joemccann/.pi/agent/git/github.com/pasky/chrome-cdp-skill/skills/chrome-cdp/scripts/cdp.mjs eval <target> "
  var pageIndicator = document.body.innerText.match(/(\\d+)\\s*\\/\\s*(\\d+)/);
  JSON.stringify({ current: pageIndicator ? parseInt(pageIndicator[1]) : 1, total: pageIndicator ? parseInt(pageIndicator[2]) : 1 });
"
```

Store the `total` page count.

### 4. Ensure Starting at Page 1

If not on page 1, navigate to page 1 by clicking the left arrow until current page is 1, or use keyboard navigation:

```bash
/Users/joemccann/.pi/agent/git/github.com/pasky/chrome-cdp-skill/skills/chrome-cdp/scripts/cdp.mjs eval <target> "
  var viewer = document.querySelector('[class*=\"viewer\"], [class*=\"document\"], body');
  if (viewer) viewer.focus();
"
```

Then send Home key or click to first page. Alternatively, modify URL with `#page=1` and navigate.

### 5. Create Output Directory

Ensure the output directory exists:

```bash
mkdir -p /Users/joemccann/dev/apps/util/specteron/artifacts/docsend
```

### 6. Screenshot Each Page

For each page from 1 to total:

#### a) Take screenshot

```bash
/Users/joemccann/.pi/agent/git/github.com/pasky/chrome-cdp-skill/skills/chrome-cdp/scripts/cdp.mjs shot <target> /Users/joemccann/dev/apps/util/specteron/artifacts/docsend/page-001.png
```

Use zero-padded page numbers (001, 002, ... 049) for proper sorting.

#### b) Navigate to next page

Click the right side of the viewer or use keyboard:

```bash
/Users/joemccann/.pi/agent/git/github.com/pasky/chrome-cdp-skill/skills/chrome-cdp/scripts/cdp.mjs eval <target> "
  var rightArrow = document.querySelector('[aria-label*=\"next\" i], [aria-label*=\"right\" i], button[class*=\"next\"], [class*=\"right-arrow\"]');
  if (rightArrow) rightArrow.click();
"
```

Or use keyboard navigation (more reliable):

```bash
/Users/joemccann/.pi/agent/git/github.com/pasky/chrome-cdp-skill/skills/chrome-cdp/scripts/cdp.mjs evalraw <target> "Input.dispatchKeyEvent" "{\"type\":\"keyDown\",\"key\":\"ArrowRight\",\"code\":\"ArrowRight\"}"
/Users/joemccann/.pi/agent/git/github.com/pasky/chrome-cdp-skill/skills/chrome-cdp/scripts/cdp.mjs evalraw <target> "Input.dispatchKeyEvent" "{\"type\":\"keyUp\",\"key\":\"ArrowRight\",\"code\":\"ArrowRight\"}"
```

#### c) Wait for page transition

Wait 500ms–1000ms between pages to ensure the new page renders fully.

#### d) Verify page changed

Re-check the page indicator to confirm navigation succeeded before taking the next screenshot.

### 7. Compile PDF

After all screenshots are captured, use ImageMagick to compile them into a PDF:

```bash
convert /Users/joemccann/dev/apps/util/specteron/artifacts/docsend/page-*.png /Users/joemccann/dev/apps/util/specteron/artifacts/docsend/<deck-name>.pdf
```

Extract `<deck-name>` from:
- The document title in the page
- The URL slug
- Or use a timestamp: `docsend-YYYY-MM-DD-HHMMSS.pdf`

To get the deck title:

```bash
/Users/joemccann/.pi/agent/git/github.com/pasky/chrome-cdp-skill/skills/chrome-cdp/scripts/cdp.mjs eval <target> "document.title"
```

### 8. Display Interactive Slide Viewer Widget

After saving the PDF, display an interactive carousel viewer using `show_widget`. Call `visualize_read_me` first if not already called this session.

**Widget specifications:**

- **Title:** `docsend_viewer`
- **Size:** 1200×800
- **Floating:** true

**IMPORTANT:** Follow the Specteron brand system (see `.pi/skills/specteron-brand/SKILL.md`):
- Include dark/light theme toggle with SVG sun/moon icons
- Use `[data-theme="dark"]` and `[data-theme="light"]` CSS selectors
- Persist theme in `localStorage` key `specteron-theme`
- Use Inter + IBM Plex Mono fonts
- 4px max border-radius, hairline borders, no shadows

**Widget layout:**

```
┌─────────────────────────────────────────────────────────────────────┐
│  HEADER: <deck-title>                    [◀ PREV] 1/49 [NEXT ▶]  ☀️ │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│                                                                     │
│                    [ SLIDE IMAGE - fills area ]                     │
│                                                                     │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│  THUMBNAIL STRIP: [1] [2] [3] [4] [5] ... scrollable                │
├─────────────────────────────────────────────────────────────────────┤
│  FOOTER: artifacts/docsend/<deck-name>.pdf · <total> slides         │
└─────────────────────────────────────────────────────────────────────┘
```

**Features:**

1. **Main slide view** — displays the current slide image, scaled to fit
2. **Navigation controls:**
   - Prev/Next buttons (Inter 13px 600, capsule style)
   - Page indicator: "X / Y" (IBM Plex Mono 12px)
   - Keyboard: ArrowLeft/ArrowRight to navigate
3. **Thumbnail strip** — horizontal scrollable row of small slide thumbnails
   - Clicking a thumbnail jumps to that slide
   - Current slide thumbnail has accent border (`--accent: #05AD98`)
   - Thumbnails: ~100px wide, maintain aspect ratio
4. **Theme toggle** — top-right, persists preference

**Image loading:**

The widget receives the slide images as base64 data URLs embedded in the HTML. Generate the widget HTML with all images inline:

```javascript
const slides = [
  { page: 1, src: 'data:image/png;base64,...' },
  { page: 2, src: 'data:image/png;base64,...' },
  // ...
];
```

To convert PNGs to base64 for embedding:

```bash
base64 -i /Users/joemccann/dev/apps/util/specteron/artifacts/docsend/page-001.png
```

**Widget HTML template structure:**

```html
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;700&display=swap" rel="stylesheet">
<style>
  /* Theme variables using [data-theme] selectors */
  /* Layout styles */
</style>

<div class="viewer">
  <header><!-- title, nav, theme toggle --></header>
  <main><!-- current slide image --></main>
  <nav class="thumbnails"><!-- scrollable thumbnail strip --></nav>
  <footer><!-- PDF path, slide count --></footer>
</div>

<script>
  const slides = [ /* base64 images */ ];
  let current = 0;
  // Navigation logic
  // Theme toggle logic (per Specteron brand skill Section 0)
  // Keyboard handlers
</script>
```

### 9. Cleanup Screenshots

After PDF is created AND widget is displayed, remove the individual PNG files:

```bash
rm /Users/joemccann/dev/apps/util/specteron/artifacts/docsend/page-*.png
```

### 10. Report Success

Tell the user:

> **DocSend deck saved.** `<total>` pages captured.
> - PDF: `artifacts/docsend/<deck-name>.pdf`
> - Interactive viewer displayed in widget

## Error Handling

- If ImageMagick's `convert` is not available, try `magick convert` or install via `brew install imagemagick`
- If a page fails to load, retry up to 3 times with increasing wait times
- If navigation gets stuck (same page indicator after arrow key), try clicking directly on the right edge of the viewer area

## Notes

- Screenshots capture the viewport, so ensure the browser window is sized appropriately for readable slides
- DocSend may have rate limiting; if pages stop loading, wait a few seconds before continuing
- The skill does NOT bypass authentication — the user must authenticate in Chrome first
