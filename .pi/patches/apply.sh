#!/usr/bin/env bash
# Apply patched files for Glimpse and pi-generative-ui.
# Run this after `pi install npm:pi-generative-ui` or `npm install`.
#
# Usage: bash .pi/patches/apply.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Locate the npm global prefix
if command -v npm &>/dev/null; then
  NPM_PREFIX="$(npm prefix -g)"
else
  echo "npm not found" >&2
  exit 1
fi

GEN_UI="$NPM_PREFIX/lib/node_modules/pi-generative-ui"
GLIMPSE="$GEN_UI/node_modules/glimpseui"

if [ ! -d "$GEN_UI" ]; then
  echo "pi-generative-ui not found at $GEN_UI" >&2
  exit 1
fi

echo "Patching generative-ui extension..."
cp "$SCRIPT_DIR/generative-ui-index.ts" "$GEN_UI/.pi/extensions/generative-ui/index.ts"

echo "Patching Glimpse Swift source..."
cp "$SCRIPT_DIR/glimpse.swift" "$GLIMPSE/src/glimpse.swift"

echo "Patching Glimpse JS module..."
cp "$SCRIPT_DIR/glimpse.mjs" "$GLIMPSE/src/glimpse.mjs"

echo "Recompiling Glimpse binary..."
cd "$GLIMPSE/src"
swiftc glimpse.swift -o glimpse -O
echo "✅ All patches applied and Glimpse recompiled."
