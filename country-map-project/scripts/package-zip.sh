#!/usr/bin/env bash
# Packs the render-ready project. Excludes node_modules, .git, the raw source
# cache and any render output — the baked assets in public/ and src/data/ are
# everything a 4K batch needs.
set -euo pipefail
cd "$(dirname "$0")/.."
NAME=country-map-project
OUT="$(pwd)/../${NAME}.zip"
rm -f "$OUT"
zip -rq "$OUT" . \
  -x 'node_modules/*' '.git/*' 'out/*' '.cache/*' '*.DS_Store'
echo "$OUT"
ls -lh "$OUT" | awk '{print $5}'
