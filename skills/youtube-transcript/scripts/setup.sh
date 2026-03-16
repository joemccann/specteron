#!/usr/bin/env bash
# setup.sh — Ensures all dependencies for youtube-transcript skill are available.
#
# Checks for:
#   1. Node.js 22+
#   2. chrome-cdp skill (installs via pi if missing)
#   3. Chrome remote debugging enabled (advisory only)
#
# Usage:
#   bash scripts/setup.sh

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

ok()   { echo -e "${GREEN}✅ $1${NC}"; }
warn() { echo -e "${YELLOW}⚠️  $1${NC}"; }
fail() { echo -e "${RED}❌ $1${NC}"; }

echo "=== youtube-transcript skill setup ==="
echo ""

# --- 1. Node.js version check ---
if ! command -v node &>/dev/null; then
  fail "Node.js is not installed. Install Node.js 22+ and retry."
  exit 1
fi

NODE_MAJOR=$(node -e "console.log(process.versions.node.split('.')[0])")
if [ "$NODE_MAJOR" -lt 22 ]; then
  fail "Node.js $NODE_MAJOR found — version 22+ required (for built-in WebSocket)."
  exit 1
fi
ok "Node.js $(node --version) detected"

# --- 2. chrome-cdp skill check ---
# Look in the standard pi package locations for the chrome-cdp skill
CDP_SEARCH_PATHS=(
  "$HOME/.pi/agent/git/github.com/pasky/chrome-cdp-skill/skills/chrome-cdp/scripts/cdp.mjs"
  "$HOME/.agents/skills/chrome-cdp/scripts/cdp.mjs"
)

# Also search project-level locations relative to this script
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_ROOT="$(cd "$SKILL_DIR/../.." && pwd)"

CDP_SEARCH_PATHS+=(
  "$PROJECT_ROOT/.pi/git/github.com/pasky/chrome-cdp-skill/skills/chrome-cdp/scripts/cdp.mjs"
  "$PROJECT_ROOT/.agents/skills/chrome-cdp/scripts/cdp.mjs"
  "$PROJECT_ROOT/.pi/skills/chrome-cdp/scripts/cdp.mjs"
  "$PROJECT_ROOT/skills/chrome-cdp/scripts/cdp.mjs"
)

CDP_PATH=""
for path in "${CDP_SEARCH_PATHS[@]}"; do
  if [ -f "$path" ]; then
    CDP_PATH="$path"
    break
  fi
done

if [ -n "$CDP_PATH" ]; then
  ok "chrome-cdp skill found at: $CDP_PATH"
else
  warn "chrome-cdp skill not found."

  # Check if pi CLI is available
  if command -v pi &>/dev/null; then
    echo "   Installing chrome-cdp skill via pi..."
    pi install git:github.com/pasky/chrome-cdp-skill
    # Verify installation
    if [ -f "$HOME/.pi/agent/git/github.com/pasky/chrome-cdp-skill/skills/chrome-cdp/scripts/cdp.mjs" ]; then
      CDP_PATH="$HOME/.pi/agent/git/github.com/pasky/chrome-cdp-skill/skills/chrome-cdp/scripts/cdp.mjs"
      ok "chrome-cdp skill installed successfully at: $CDP_PATH"
    else
      fail "chrome-cdp installation completed but cdp.mjs not found at expected path."
      echo "   Try manually: pi install git:github.com/pasky/chrome-cdp-skill"
      exit 1
    fi
  else
    fail "pi CLI not found. Install chrome-cdp manually:"
    echo "   pi install git:github.com/pasky/chrome-cdp-skill"
    echo ""
    echo "   Or clone it directly:"
    echo "   git clone https://github.com/pasky/chrome-cdp-skill ~/.pi/agent/git/github.com/pasky/chrome-cdp-skill"
    exit 1
  fi
fi

# --- 3. Chrome remote debugging check (advisory) ---
echo ""
# Try to reach Chrome's DevTools JSON endpoint
if curl -s --connect-timeout 2 http://localhost:9222/json/version &>/dev/null; then
  ok "Chrome remote debugging is reachable on port 9222"
elif curl -s --connect-timeout 2 http://localhost:9229/json/version &>/dev/null; then
  ok "Chrome remote debugging is reachable on port 9229"
else
  warn "Chrome remote debugging may not be enabled."
  echo "   Open chrome://inspect/#remote-debugging in Chrome and toggle the switch."
  echo "   (This is required for transcript extraction to work.)"
fi

echo ""
echo "=== Setup complete ==="
echo ""
echo "CDP path: $CDP_PATH"
echo ""
echo "Usage:"
echo "  node $SKILL_DIR/scripts/extract-transcript.mjs \\"
echo "    \"$CDP_PATH\" \\"
echo "    \"https://www.youtube.com/watch?v=VIDEO_ID\" \\"
echo "    /tmp/transcript.txt"
