#!/usr/bin/env bash
# Builds light-sparkle-backgrounds-project.zip (no node_modules, .git, refs/ or render output).
set -euo pipefail
cd "$(dirname "$0")/.."
OUT="${1:-deliverables/light-sparkle-backgrounds-project.zip}"
mkdir -p "$(dirname "$OUT")"
rm -f "$OUT"
STAGE="$(mktemp -d)/light-sparkle-backgrounds"
mkdir -p "$STAGE"
cp -r src scripts README.md package.json package-lock.json tsconfig.json remotion.config.ts .gitignore "$STAGE"/
(cd "$(dirname "$STAGE")" && zip -qr - light-sparkle-backgrounds) > "$OUT"
echo "$OUT"
