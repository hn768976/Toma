#!/usr/bin/env bash
# Builds the hand-off archive: the whole Remotion project, including the
# 4K compositions and the baked mesh, minus anything reproducible.
#
# node_modules and rendered output are excluded; `npm install` and
# tools/render-all.sh regenerate both.
#
# Usage: tools/package-project.sh [output.zip]
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="${1:-$ROOT/dental-3d-project.zip}"
cd "$ROOT/.."

rm -f "$OUT"
zip -r -q "$OUT" "$(basename "$ROOT")" \
  -x "*/node_modules/*" \
  -x "*/out/*" \
  -x "*/.git/*" \
  -x "*.zip" \
  -x "*/.DS_Store"

echo "Wrote $OUT ($(du -h "$OUT" | cut -f1))"
unzip -l "$OUT" | tail -1
