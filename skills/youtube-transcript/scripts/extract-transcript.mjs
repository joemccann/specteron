#!/usr/bin/env node
/**
 * extract-transcript.mjs
 *
 * Extracts the full transcript from a YouTube video tab via Chrome CDP.
 * Requires:
 *   - Chrome with remote debugging enabled
 *   - The chrome-cdp skill's cdp.mjs available at the path passed as CDP_PATH
 *
 * Usage:
 *   node extract-transcript.mjs <cdp-path> <youtube-url> [output-file]
 *
 * The script will:
 *   1. Find or navigate to the YouTube URL in Chrome
 *   2. Expand the video description
 *   3. Click "Show transcript"
 *   4. Extract all transcript text from the transcript panel
 *   5. Clean the transcript and write to output file
 */

import { execSync } from "child_process";
import { writeFileSync } from "fs";
import { resolve } from "path";

const CDP = process.argv[2];
const YOUTUBE_URL = process.argv[3];
const OUTPUT = process.argv[4] || "/tmp/youtube-transcript.txt";

if (!CDP || !YOUTUBE_URL) {
  console.error(
    "Usage: node extract-transcript.mjs <cdp-path> <youtube-url> [output-file]"
  );
  process.exit(1);
}

// Validate it looks like a YouTube URL
if (
  !YOUTUBE_URL.includes("youtube.com/watch") &&
  !YOUTUBE_URL.includes("youtu.be/")
) {
  console.error("Error: URL does not appear to be a YouTube video URL.");
  process.exit(1);
}

function cdp(...args) {
  const cmd = `${CDP} ${args.map((a) => `'${a.replace(/'/g, "'\\''")}'`).join(" ")}`;
  try {
    return execSync(cmd, {
      encoding: "utf-8",
      timeout: 30000,
      maxBuffer: 10 * 1024 * 1024,
    }).trim();
  } catch (e) {
    const output = (e.stdout || "") + (e.stderr || "");
    if (output.trim()) return output.trim();
    throw e;
  }
}

function sleep(ms) {
  execSync(`sleep ${ms / 1000}`);
}

// Step 1: Find the YouTube tab
console.log("🔍 Searching for YouTube tab...");
const listOutput = cdp("list");
const lines = listOutput.split("\n");

let targetId = null;

// Extract video ID from URL
const videoIdMatch = YOUTUBE_URL.match(
  /(?:v=|youtu\.be\/)([A-Za-z0-9_-]{11})/
);
const videoId = videoIdMatch ? videoIdMatch[1] : null;

for (const line of lines) {
  // Check if this tab has the YouTube URL or video ID
  if (
    videoId &&
    (line.includes(videoId) || line.includes("youtube.com/watch"))
  ) {
    const idMatch = line.match(/^([A-F0-9]+)\s/);
    if (idMatch) {
      targetId = idMatch[1];
      break;
    }
  }
}

if (!targetId) {
  // Try to find any YouTube tab and navigate it
  for (const line of lines) {
    if (line.includes("youtube.com")) {
      const idMatch = line.match(/^([A-F0-9]+)\s/);
      if (idMatch) {
        targetId = idMatch[1];
        console.log(`📺 Found YouTube tab ${targetId}, navigating to video...`);
        cdp("nav", targetId, YOUTUBE_URL);
        sleep(3000);
        break;
      }
    }
  }
}

if (!targetId) {
  console.error(
    "Error: No YouTube tab found in Chrome. Please open the YouTube video in Chrome first."
  );
  console.error("Open tabs:");
  console.error(listOutput);
  process.exit(1);
}

console.log(`✅ Found target: ${targetId}`);

// Make sure we're on the right URL
const currentUrl = cdp("eval", targetId, "window.location.href");
if (videoId && !currentUrl.includes(videoId)) {
  console.log("📺 Navigating to the correct video...");
  cdp("nav", targetId, YOUTUBE_URL);
  sleep(3000);
}

// Step 2: Expand description to reveal "Show transcript" button
console.log("📖 Expanding video description...");
cdp(
  "eval",
  targetId,
  `
  (function() {
    const btn = document.querySelector('tp-yt-paper-button#expand');
    if (btn) btn.click();
    return 'done';
  })()
`
);
sleep(1500);

// Step 3: Click "Show transcript"
console.log("📝 Opening transcript panel...");
const clickResult = cdp(
  "eval",
  targetId,
  `
  (function() {
    const buttons = [...document.querySelectorAll('button')];
    const btn = buttons.find(b => b.textContent.includes('Show transcript'));
    if (btn) { btn.click(); return 'clicked'; }
    return 'not-found';
  })()
`
);

if (clickResult.includes("not-found")) {
  console.error(
    "Error: Could not find 'Show transcript' button. The video may not have a transcript available."
  );
  process.exit(1);
}

console.log("⏳ Waiting for transcript to load...");
sleep(3000);

// Step 4: Find the transcript panel and get its text length
console.log("📊 Locating transcript panel...");
const panelInfo = cdp(
  "eval",
  targetId,
  `
  (function() {
    const panels = document.querySelectorAll('ytd-engagement-panel-section-list-renderer');
    let transcriptIdx = -1;
    let textLen = 0;
    for (let i = 0; i < panels.length; i++) {
      const vis = panels[i].getAttribute('visibility');
      const tid = panels[i].getAttribute('target-id');
      if (vis === 'ENGAGEMENT_PANEL_VISIBILITY_EXPANDED' &&
          (tid === 'PAmodern_transcript_view' || tid === 'engagement-panel-searchable-transcript')) {
        transcriptIdx = i;
        textLen = panels[i].innerText.length;
        break;
      }
    }
    return JSON.stringify({idx: transcriptIdx, len: textLen});
  })()
`
);

let parsed;
try {
  parsed = JSON.parse(panelInfo);
} catch {
  console.error("Error: Could not parse transcript panel info:", panelInfo);
  process.exit(1);
}

if (parsed.idx === -1) {
  console.error(
    "Error: Transcript panel not found or not visible. Try manually opening the transcript."
  );
  process.exit(1);
}

const panelIdx = parsed.idx;
const totalLen = parsed.len;
console.log(
  `✅ Found transcript panel (index ${panelIdx}, ~${totalLen} chars)`
);

// Step 5: Extract transcript text in chunks
console.log("📥 Extracting transcript text...");
const CHUNK_SIZE = 10000;
const chunks = Math.ceil(totalLen / CHUNK_SIZE);
let rawText = "";

for (let i = 0; i < chunks; i++) {
  const start = i * CHUNK_SIZE;
  const end = start + CHUNK_SIZE;
  const chunk = cdp(
    "eval",
    targetId,
    `document.querySelectorAll('ytd-engagement-panel-section-list-renderer')[${panelIdx}].innerText.substring(${start}, ${end})`
  );
  rawText += chunk;
  process.stdout.write(
    `\r  Chunk ${i + 1}/${chunks} (${Math.min(end, totalLen)}/${totalLen} chars)`
  );
}
console.log("");

// Step 6: Extract video title
console.log("🎬 Extracting video metadata...");
const title = cdp(
  "eval",
  targetId,
  `document.querySelector('yt-formatted-string.ytd-watch-metadata')?.textContent?.trim() || document.title`
);
const channelName = cdp(
  "eval",
  targetId,
  `document.querySelector('ytd-channel-name yt-formatted-string a')?.textContent?.trim() || 'Unknown'`
);
const viewsDate = cdp(
  "eval",
  targetId,
  `document.querySelector('yt-formatted-string.ytd-watch-info-text span')?.textContent?.trim() || ''`
);

// Step 7: Clean the transcript
console.log("🧹 Cleaning transcript...");
const cleanedLines = [];
const rawLines = rawText.split("\n");

// Regex for descriptive timestamps like "1 minute, 43 seconds" or "1 hour, 13 minutes, 50 seconds"
const descriptiveTimestamp =
  /^(\d+ hours?,?\s*)?(\d+ minutes?,?\s*)?(\d+ seconds?)?$/;
const shortTimestamp = /^\d+:\d+/;

for (const rawLine of rawLines) {
  const line = rawLine.trimEnd();
  const trimmed = line.trim();

  // Skip header
  if (trimmed === "Transcript") continue;
  // Skip "Sync to video time" footer text
  if (trimmed === "Sync to video time") continue;

  // Skip descriptive timestamps
  if (trimmed && descriptiveTimestamp.test(trimmed)) continue;

  // Format short timestamps
  if (shortTimestamp.test(trimmed)) {
    cleanedLines.push("");
    cleanedLines.push(`[${trimmed}]`);
    continue;
  }

  // Keep chapter headers
  if (trimmed.startsWith("Chapter")) {
    cleanedLines.push("");
    cleanedLines.push(trimmed);
    continue;
  }

  // Keep text content
  if (trimmed) {
    cleanedLines.push(trimmed);
  }
}

const cleanedText = cleanedLines.join("\n").replace(/\n{3,}/g, "\n\n").trim();

// Step 8: Write output
const output = `# ${title}

**Channel:** ${channelName}
**URL:** ${YOUTUBE_URL}

---

## Transcript

${cleanedText}
`;

writeFileSync(resolve(OUTPUT), output, "utf-8");
console.log(`\n✅ Transcript saved to ${resolve(OUTPUT)}`);
console.log(`   ${cleanedText.length} chars, ${cleanedText.split("\n").length} lines`);
