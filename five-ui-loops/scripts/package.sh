#!/usr/bin/env bash
# Build five-ui-loops-project.zip: source, config, pinned package files, fonts,
# Natural Earth data + licences, README, scripts. No node_modules/.git/renders.
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=${1:-../five-ui-loops-project.zip}
rm -f "$OUT"
zip -qr "$OUT" \
  README.md package.json package-lock.json tsconfig.json remotion.config.ts .gitignore \
  src public scripts \
  -x "*.DS_Store"
unzip -l "$OUT" | tail -1
