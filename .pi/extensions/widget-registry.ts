/**
 * Widget Registry Extension
 *
 * Maintains persistent widgets across pi sessions by running a long-lived
 * relay process that keeps Glimpse windows open.
 *
 * Architecture:
 * 1. Each persistent widget has a relay process that:
 *    - Spawns Glimpse and pipes to its stdin
 *    - Listens on a Unix domain socket for commands
 *    - Stays alive indefinitely (until explicitly closed)
 *
 * 2. Registry file (.pi/widget-registry.json) tracks:
 *    - { title, pid (of relay), socketPath, glimpsePid }
 *
 * 3. When update_widget is called:
 *    - If widget exists and relay is alive → send update via socket
 *    - Otherwise → spawn new relay + glimpse pair
 *
 * This allows scheduled tasks like gmail-inbox-monitor to update an existing
 * widget window instead of opening a new one each time.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as net from "node:net";
import { spawn, fork } from "node:child_process";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

interface WidgetEntry {
  title: string;
  relayPid: number;
  socketPath: string;
  createdAt: string;
}

interface WidgetRegistry {
  widgets: WidgetEntry[];
}

const REGISTRY_FILENAME = "widget-registry.json";

export default function (pi: ExtensionAPI) {
  let projectCwd = "";
  let registryPath = "";
  let socketsDir = "";

  function ensureDirectories(): void {
    const piDir = path.join(projectCwd, ".pi");
    if (!fs.existsSync(piDir)) fs.mkdirSync(piDir, { recursive: true });
    
    socketsDir = path.join(piDir, "sockets");
    if (!fs.existsSync(socketsDir)) fs.mkdirSync(socketsDir, { recursive: true });
  }

  function loadRegistry(): WidgetRegistry {
    try {
      const raw = fs.readFileSync(registryPath, "utf-8");
      return JSON.parse(raw) as WidgetRegistry;
    } catch {
      return { widgets: [] };
    }
  }

  function saveRegistry(data: WidgetRegistry): void {
    fs.writeFileSync(registryPath, JSON.stringify(data, null, 2) + "\n", "utf-8");
  }

  function isProcessAlive(pid: number): boolean {
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  }

  function cleanDeadWidgets(): void {
    const registry = loadRegistry();
    const alive: WidgetEntry[] = [];
    
    for (const entry of registry.widgets) {
      if (isProcessAlive(entry.relayPid)) {
        alive.push(entry);
      } else {
        // Clean up socket file
        try { fs.unlinkSync(entry.socketPath); } catch {}
      }
    }
    
    if (alive.length !== registry.widgets.length) {
      saveRegistry({ widgets: alive });
    }
  }

  function findWidget(title: string): WidgetEntry | undefined {
    const registry = loadRegistry();
    return registry.widgets.find(w => w.title === title && isProcessAlive(w.relayPid));
  }

  async function sendToWidget(entry: WidgetEntry, command: object): Promise<boolean> {
    return new Promise((resolve) => {
      const client = net.createConnection(entry.socketPath, () => {
        client.write(JSON.stringify(command) + "\n");
        client.end();
        resolve(true);
      });
      
      client.on("error", () => {
        resolve(false);
      });
      
      // Timeout after 2 seconds
      setTimeout(() => {
        client.destroy();
        resolve(false);
      }, 2000);
    });
  }

  pi.on("session_start", async (_event, ctx) => {
    projectCwd = ctx.cwd;
    registryPath = path.join(projectCwd, ".pi", REGISTRY_FILENAME);
    ensureDirectories();
    cleanDeadWidgets();
  });

  // Tool to update or create a persistent widget
  pi.registerTool({
    name: "update_widget",
    label: "Update Widget",
    description:
      "Update an existing persistent widget or create a new one. If a widget with the same title " +
      "is already open, updates its content. Otherwise, opens a new window. The widget stays open " +
      "after the pi process exits. Use for dashboards, monitors, and scheduled task displays.",
    parameters: {
      type: "object" as const,
      required: ["title", "html"],
      properties: {
        title: {
          type: "string" as const,
          description: "Widget identifier (snake_case). Used to find existing windows.",
        },
        html: {
          type: "string" as const,
          description: "HTML fragment to display (styles, then HTML, then scripts — no doctype/html/body).",
        },
        width: {
          type: "number" as const,
          description: "Window width in pixels (default: 800). Ignored if widget already exists.",
        },
        height: {
          type: "number" as const,
          description: "Window height in pixels (default: 600). Ignored if widget already exists.",
        },
        floating: {
          type: "boolean" as const,
          description: "Keep window on top (default: false). Ignored if widget already exists.",
        },
      },
    },

    async execute(_toolCallId, params: {
      title: string;
      html: string;
      width?: number;
      height?: number;
      floating?: boolean;
    }) {
      const { title, html } = params;
      const width = params.width ?? 800;
      const height = params.height ?? 600;
      const floating = params.floating ?? false;

      // Check for existing widget
      const existing = findWidget(title);
      
      if (existing) {
        // Send update to existing widget via socket
        const fullHtml = wrapHTML(html);
        const base64 = Buffer.from(fullHtml).toString("base64");
        const success = await sendToWidget(existing, { type: "html", html: base64 });
        
        if (success) {
          return {
            content: [{
              type: "text" as const,
              text: `Widget "${title}" updated. Window is still open (relay pid: ${existing.relayPid}).`,
            }],
            details: { action: "updated", relayPid: existing.relayPid },
          };
        }
        
        // Failed to send — relay probably died, remove from registry
        const registry = loadRegistry();
        registry.widgets = registry.widgets.filter(w => w.title !== title);
        saveRegistry(registry);
        try { fs.unlinkSync(existing.socketPath); } catch {}
      }

      // Create new persistent widget with relay process
      const socketPath = path.join(socketsDir, `widget-${title}.sock`);
      
      // Remove stale socket file if exists
      try { fs.unlinkSync(socketPath); } catch {}

      // Find glimpse binary
      const glimpsePath = findGlimpseBinary();
      if (!glimpsePath) {
        return {
          content: [{
            type: "text" as const,
            text: "Error: Glimpse binary not found. Is pi-generative-ui installed?",
          }],
          details: { error: "glimpse_not_found" },
        };
      }

      // Spawn relay process
      const relayScript = path.join(projectCwd, ".pi", "extensions", "widget-relay.mjs");
      
      // Write the relay script if it doesn't exist
      await ensureRelayScript(relayScript);

      const fullHtml = wrapHTML(html);
      const displayTitle = title.replace(/_/g, " ");

      const relay = spawn("node", [
        relayScript,
        "--glimpse", glimpsePath,
        "--socket", socketPath,
        "--title", displayTitle,
        "--width", String(width),
        "--height", String(height),
        "--html", fullHtml,
        ...(floating ? ["--floating"] : []),
      ], {
        stdio: "ignore",
        detached: true,
      });

      relay.unref();

      // Wait for socket to become available
      let connected = false;
      for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 100));
        if (fs.existsSync(socketPath)) {
          connected = true;
          break;
        }
      }

      if (!connected) {
        return {
          content: [{
            type: "text" as const,
            text: `Error: Widget relay failed to start for "${title}".`,
          }],
          details: { error: "relay_timeout" },
        };
      }

      // Register the widget
      const registry = loadRegistry();
      registry.widgets = registry.widgets.filter(w => w.title !== title); // Remove any stale entry
      registry.widgets.push({
        title,
        relayPid: relay.pid!,
        socketPath,
        createdAt: new Date().toISOString(),
      });
      saveRegistry(registry);

      return {
        content: [{
          type: "text" as const,
          text: `Widget "${title}" opened (relay pid: ${relay.pid}). Window will persist after this process exits.`,
        }],
        details: { action: "created", relayPid: relay.pid },
      };
    },
  });

  // Tool to close a persistent widget
  pi.registerTool({
    name: "close_widget",
    label: "Close Widget",
    description: "Close a persistent widget by title.",
    parameters: {
      type: "object" as const,
      required: ["title"],
      properties: {
        title: {
          type: "string" as const,
          description: "Widget identifier to close.",
        },
      },
    },

    async execute(_toolCallId, params: { title: string }) {
      const existing = findWidget(params.title);
      
      if (!existing) {
        return {
          content: [{
            type: "text" as const,
            text: `No active widget found with title "${params.title}".`,
          }],
          details: { found: false },
        };
      }

      // Send close command
      await sendToWidget(existing, { type: "close" });

      // Remove from registry
      const registry = loadRegistry();
      registry.widgets = registry.widgets.filter(w => w.title !== params.title);
      saveRegistry(registry);

      // Clean up socket
      try { fs.unlinkSync(existing.socketPath); } catch {}

      return {
        content: [{
          type: "text" as const,
          text: `Widget "${params.title}" closed.`,
        }],
        details: { found: true, relayPid: existing.relayPid },
      };
    },
  });

  // Command to list active widgets
  pi.registerCommand("widgets", {
    description: "List all active persistent widgets",
    handler: async (_args, ctx) => {
      cleanDeadWidgets();
      const registry = loadRegistry();

      if (registry.widgets.length === 0) {
        ctx.ui.notify("No active widgets.", "info");
        return;
      }

      const lines = ["", "🪟 Active Widgets:", ""];
      for (const w of registry.widgets) {
        lines.push(`  • ${w.title} (relay pid: ${w.relayPid})`);
        lines.push(`    Created: ${w.createdAt}`);
      }

      ctx.ui.notify(lines.join("\n"), "info");
    },
  });
}

// Script to intercept link clicks and open them in the default browser
const EXTERNAL_LINK_SCRIPT = `
<script>
(function() {
  document.addEventListener('click', function(e) {
    var link = e.target.closest('a[href]');
    if (!link) return;
    var href = link.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;
    // Send URL to relay to open in default browser
    e.preventDefault();
    if (window.glimpse && window.glimpse.send) {
      window.glimpse.send({ type: 'open-url', url: href });
    }
  }, true);
})();
</script>
`;

// Helper to wrap HTML fragment in a full document
function wrapHTML(code: string): string {
  const isSVG = code.trimStart().startsWith("<svg");
  if (isSVG) {
    return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#1a1a1a;color:#e0e0e0;">
${code}${EXTERNAL_LINK_SCRIPT}</body></html>`;
  }
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<style>*{box-sizing:border-box}body{margin:0;padding:1rem;font-family:system-ui,-apple-system,sans-serif;background:#1a1a1a;color:#e0e0e0}</style>
</head><body>${code}${EXTERNAL_LINK_SCRIPT}</body></html>`;
}

// Find the glimpse binary
function findGlimpseBinary(): string | null {
  const candidates = [
    "/Users/joemccann/.nvm/versions/node/v24.14.0/lib/node_modules/pi-generative-ui/node_modules/glimpseui/src/glimpse",
    path.join(process.cwd(), "node_modules/glimpseui/src/glimpse"),
    path.join(process.cwd(), "node_modules/pi-generative-ui/node_modules/glimpseui/src/glimpse"),
  ];

  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

// Ensure the relay script exists
async function ensureRelayScript(scriptPath: string): Promise<void> {
  if (fs.existsSync(scriptPath)) return;

  const script = `#!/usr/bin/env node
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
  const lines = buffer.split("\\n");
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
  glimpse.stdin.write(JSON.stringify(cmd) + "\\n");
}

// Socket server for receiving updates
const server = net.createServer((conn) => {
  let data = "";
  
  conn.on("data", (chunk) => {
    data += chunk.toString();
  });
  
  conn.on("end", () => {
    for (const line of data.split("\\n")) {
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
`;

  fs.writeFileSync(scriptPath, script, { mode: 0o755 });
}
