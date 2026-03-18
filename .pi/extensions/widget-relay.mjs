#!/usr/bin/env node
/**
 * Widget Relay Process
 *
 * Spawns a Glimpse window and keeps it alive by:
 * 1. Piping commands to Glimpse's stdin
 * 2. Listening on a Unix domain socket for update commands
 * 3. Handling messages from the widget (e.g., open-url to launch external browser)
 *
 * Exits when: the Glimpse window is closed, or a "close" command is received.
 */

import { spawn } from "node:child_process";
import * as net from "node:net";
import * as fs from "node:fs";

// Parse CLI args
const args = process.argv.slice(2);
function getArg(name) {
  const idx = args.indexOf("--" + name);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : null;
}
function hasFlag(name) {
  return args.includes("--" + name);
}

const glimpsePath = getArg("glimpse");
const socketPath = getArg("socket");
const title = getArg("title") || "Widget";
const width = getArg("width") || "800";
const height = getArg("height") || "600";
const initialHtml = getArg("html");
const floating = hasFlag("floating");

if (!glimpsePath || !socketPath) {
  console.error("Usage: widget-relay.mjs --glimpse <path> --socket <path> --title <t> --width <w> --height <h> --html <html> [--floating]");
  process.exit(1);
}

// Spawn Glimpse
const glimpseArgs = ["--width", width, "--height", height, "--title", title];
if (floating) glimpseArgs.push("--floating");

const glimpse = spawn(glimpsePath, glimpseArgs, {
  stdio: ["pipe", "pipe", "inherit"],
});

let ready = false;
let pendingHtml = initialHtml;

// Handle Glimpse stdout (JSON protocol)
let buffer = "";
glimpse.stdout.on("data", (chunk) => {
  buffer += chunk.toString();
  const lines = buffer.split("\n");
  buffer = lines.pop() || "";
  
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const msg = JSON.parse(line);
      if (msg.type === "ready") {
        if (!ready && pendingHtml) {
          // First ready = shell loaded, send actual content
          sendToGlimpse({ type: "html", html: Buffer.from(pendingHtml).toString("base64") });
          pendingHtml = null;
        } else {
          ready = true;
        }
      } else if (msg.type === "closed") {
        cleanup();
        process.exit(0);
      } else if (msg.type === "message") {
        // Handle messages from the widget
        handleWidgetMessage(msg.data);
      }
    } catch {}
  }
});

// Handle messages sent from the widget via window.glimpse.send()
function handleWidgetMessage(data) {
  if (!data) return;
  
  if (data.type === "open-url" && data.url) {
    // Open URL in default browser using macOS 'open' command
    const url = data.url;
    // Basic URL validation to prevent command injection
    if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("mailto:")) {
      spawn("open", [url], { detached: true, stdio: "ignore" }).unref();
    }
  }
}

glimpse.on("exit", () => {
  cleanup();
  process.exit(0);
});

glimpse.on("error", (err) => {
  console.error("Glimpse error:", err);
  cleanup();
  process.exit(1);
});

// Send command to Glimpse
function sendToGlimpse(cmd) {
  glimpse.stdin.write(JSON.stringify(cmd) + "\n");
}

// Socket server for receiving updates
const server = net.createServer((conn) => {
  let data = "";
  
  conn.on("data", (chunk) => {
    data += chunk.toString();
  });
  
  conn.on("end", () => {
    for (const line of data.split("\n")) {
      if (!line.trim()) continue;
      try {
        const cmd = JSON.parse(line);
        if (cmd.type === "close") {
          sendToGlimpse({ type: "close" });
          setTimeout(() => {
            cleanup();
            process.exit(0);
          }, 500);
        } else {
          sendToGlimpse(cmd);
        }
      } catch {}
    }
  });
});

function cleanup() {
  try { server.close(); } catch {}
  try { fs.unlinkSync(socketPath); } catch {}
}

// Handle signals
process.on("SIGTERM", () => { cleanup(); process.exit(0); });
process.on("SIGINT", () => { cleanup(); process.exit(0); });

// Start listening
server.listen(socketPath, () => {
  // Socket is ready
});
