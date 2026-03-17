---
name: docsend-deck-scraper
description: Scrape a DocSend deck to PDF and interactive viewer. Takes a DocSend URL (must be authenticated in Chrome), extracts slide image URLs via page_data API, downloads them, compiles into a PDF, and displays a carousel widget. Usage: /skill:docsend-deck-scraper <url>
---

# DocSend Deck Scraper

Scrapes all pages of a DocSend presentation by fetching signed image URLs from the page_data API endpoints, downloads them, compiles into a PDF, and displays an interactive slide viewer widget.

## Prerequisites

- Chrome running with remote debugging on port 9222
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

### 2. Dismiss Cookie Modal

DocSend shows a cookie consent modal. Dismiss it by clicking "Decline":

```bash
/Users/joemccann/.pi/agent/git/github.com/pasky/chrome-cdp-skill/skills/chrome-cdp/scripts/cdp.mjs eval <target> "
  var declineBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Decline');
  if (declineBtn) { declineBtn.click(); 'dismissed'; } else { 'no-modal'; }
"
```

Wait 500ms after dismissing.

### 3. Check Authentication

DocSend requires authentication when it shows a modal with "X requests your action to continue" and an Email input.

**Key indicator of authenticated state:** The presence of `.carousel-inner.js-carousel-inner` containing `.preso-view.page-view` images with a page count indicator (e.g., "1 / 49").

```bash
/Users/joemccann/.pi/agent/git/github.com/pasky/chrome-cdp-skill/skills/chrome-cdp/scripts/cdp.mjs eval <target> "
  var carousel = document.querySelector('.carousel-inner.js-carousel-inner');
  var pageImages = document.querySelectorAll('img.preso-view.page-view');
  var hasAuthModal = document.body.innerText.includes('requests your action to continue');
  var hasEmailInput = document.querySelector('input[type=\"email\"]') !== null;
  var pageMatch = document.body.innerText.match(/(\\d+)\\s*\\/\\s*(\\d+)/);
  var totalPages = pageMatch ? parseInt(pageMatch[2]) : 0;
  var isAuthenticated = carousel !== null && pageImages.length > 0 && totalPages > 0 && !hasAuthModal;
  JSON.stringify({ 
    isAuthenticated: isAuthenticated, 
    totalPages: totalPages,
    hasAuthModal: hasAuthModal,
    hasEmailInput: hasEmailInput
  });
"
```

If `isAuthenticated` is `false`, **STOP** and tell the user:

> **Authentication required.** Please log in or enter the passcode for this DocSend link in Chrome, then run this command again.

### 4. Extract DocSend View ID

Extract the view ID from the URL (e.g., `eajeenhwrx7quzge` from `https://docsend.com/view/eajeenhwrx7quzge`).

### 5. Fetch All Page Image URLs via page_data API

DocSend lazy-loads images, but we can fetch signed URLs directly from the `page_data` API endpoints. Each page has an endpoint like:

```
https://docsend.com/view/<view-id>/page_data/<page-number>
```

This returns JSON with `imageUrl` containing the signed CloudFront URL.

Fetch all URLs from Chrome's context (to use the authenticated session):

```bash
/Users/joemccann/.pi/agent/git/github.com/pasky/chrome-cdp-skill/skills/chrome-cdp/scripts/cdp.mjs eval <target> "
window._allImageUrls = [];
window._fetchComplete = false;

(async function() {
  var viewId = '<view-id>';
  var totalPages = <total>;
  for (var i = 1; i <= totalPages; i++) {
    try {
      var resp = await fetch('https://docsend.com/view/' + viewId + '/page_data/' + i);
      var data = await resp.json();
      window._allImageUrls.push({ page: i, url: data.imageUrl });
    } catch(e) {
      window._allImageUrls.push({ page: i, error: e.message });
    }
  }
  window._fetchComplete = true;
})();

'started';
"
```

Wait for completion:

```bash
# Poll until complete (usually 5-15 seconds for 50 pages)
/Users/joemccann/.pi/agent/git/github.com/pasky/chrome-cdp-skill/skills/chrome-cdp/scripts/cdp.mjs eval <target> "
  JSON.stringify({ complete: window._fetchComplete, count: window._allImageUrls.length });
"
```

Retrieve the URLs:

```bash
/Users/joemccann/.pi/agent/git/github.com/pasky/chrome-cdp-skill/skills/chrome-cdp/scripts/cdp.mjs eval <target> "JSON.stringify(window._allImageUrls);"
```

Save to a temp file for processing.

### 6. Create Output Directory

First, determine the deck name from the page title or URL slug. Sanitize it: lowercase, replace spaces with hyphens, remove special characters.

Example: "NEUROPHOS EXAOPS — March 2026" → `neurophos-exaops-march-2026`

Create a subdirectory for this deck:

```bash
DECK_NAME="neurophos-exaops-march-2026"  # derived from title
mkdir -p /Users/joemccann/dev/apps/util/specteron/artifacts/docsend/${DECK_NAME}
```

All images and the final PDF go in this deck-specific directory.

### 7. Download All Slide Images (Parallel)

Use Node.js to download all images in parallel (10 concurrent downloads for speed):

```bash
node -e "
const fs = require('fs');
const https = require('https');
const data = JSON.parse(fs.readFileSync('/tmp/docsend_urls.json', 'utf8'));

function downloadImage(url, filepath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filepath);
    https.get(url, (response) => {
      response.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    }).on('error', (err) => { fs.unlink(filepath, () => {}); reject(err); });
  });
}

const DECK_DIR = '/Users/joemccann/dev/apps/util/specteron/artifacts/docsend/<deck-name>';

async function downloadBatch(items, concurrency = 10) {
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const promises = batch.map(item => {
      const pageNum = String(item.page).padStart(3, '0');
      const filepath = DECK_DIR + '/page-' + pageNum + '.png';
      console.log('Downloading page ' + item.page + '...');
      return downloadImage(item.url, filepath);
    });
    await Promise.all(promises);
    console.log('Batch ' + Math.ceil((i + concurrency) / concurrency) + ' complete');
  }
}

downloadBatch(data, 10).then(() => console.log('Done!'));
"
```

This downloads 10 images at a time, completing a 49-page deck in ~5 batches instead of 49 sequential requests.

### 8. Get Deck Title

```bash
/Users/joemccann/.pi/agent/git/github.com/pasky/chrome-cdp-skill/skills/chrome-cdp/scripts/cdp.mjs eval <target> "
  var title = document.querySelector('meta[property=\"og:title\"]');
  title ? title.content : document.title;
"
```

Use this for the PDF filename (sanitized: lowercase, hyphens, no special chars).

### 9. Compile PDF

```bash
magick /Users/joemccann/dev/apps/util/specteron/artifacts/docsend/<deck-name>/page-*.png /Users/joemccann/dev/apps/util/specteron/artifacts/docsend/<deck-name>/<deck-name>.pdf
```

If `magick` is not available, try `convert` or install via `brew install imagemagick`.

### 10. Display Interactive Slide Viewer Widget

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

The widget receives the slide images as base64 data URLs embedded in the HTML:

```javascript
const slides = [
  { page: 1, src: 'data:image/png;base64,...' },
  { page: 2, src: 'data:image/png;base64,...' },
  // ...
];
```

To convert PNGs to base64:

```bash
base64 -i /Users/joemccann/dev/apps/util/specteron/artifacts/docsend/page-001.png
```

### 11. Cleanup Screenshots (Optional)

After PDF is created AND widget is displayed, optionally remove the individual PNG files:

```bash
rm /Users/joemccann/dev/apps/util/specteron/artifacts/docsend/<deck-name>/page-*.png
```

Or keep them for the interactive viewer widget to use.

### 12. Report Success

Tell the user:

> **DocSend deck saved.** `<total>` pages captured.
> - PDF: `artifacts/docsend/<deck-name>.pdf`
> - Interactive viewer displayed in widget

## Error Handling

- If `page_data` fetch fails, the CloudFront URLs may have expired - re-authenticate the page
- If ImageMagick is not available, install via `brew install imagemagick`

## Notes

- The `page_data` API returns signed CloudFront URLs that expire - download promptly after fetching
- This approach downloads clean slide images without browser chrome
- The skill does NOT bypass authentication — the user must authenticate in Chrome first
