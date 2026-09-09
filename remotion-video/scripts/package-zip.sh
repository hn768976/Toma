#!/usr/bin/env bash
# Packages the project as sphere-ripple-stills.zip, excluding node_modules,
# out and .git. Run from the project root.
set -euo pipefail

cd "$(dirname "$0")/.."
OUT="sphere-ripple-stills.zip"
rm -f "$OUT"

zip -r -q "$OUT" \
  src scripts public \
  package.json package-lock.json tsconfig.json remotion.config.ts \
  README.md .prettierrc eslint.config.mjs .gitignore \
  -x '*/node_modules/*' '*/.git/*' 'out/*' '*.DS_Store'

echo "$OUT"
unzip -l "$OUT" | tail -1
