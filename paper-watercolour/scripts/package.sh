#!/usr/bin/env bash
# Zips the project for delivery: source, paint script + painted layers,
# Natural Earth data, pinned package.json/lock, README. No node_modules,
# .git or render output.
set -euo pipefail
cd "$(dirname "$0")/.."
OUT="${1:-../paper-watercolour-backgrounds-project.zip}"
rm -f "$OUT"
zip -r -q "$OUT" \
  package.json package-lock.json tsconfig.json remotion.config.ts README.md .gitignore \
  src scripts public \
  -x "*.DS_Store" "*/node_modules/*" "renders/*" "out/*"
unzip -l "$OUT" | tail -1
