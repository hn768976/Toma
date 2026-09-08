#!/usr/bin/env bash
# Builds route-map-project.zip: the full 4K-render-ready project, minus
# node_modules, .git and any render output.
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${1:-$HERE/../deliverables/route-map-project.zip}"
rm -f "$OUT"
cd "$(dirname "$HERE")"
zip -q -r -9 "$OUT" "$(basename "$HERE")" \
  -x "*/node_modules/*" "*/.git/*" "*/out/*" "*/.remotion/*" "*.log" "*/.DS_Store"
echo "$OUT  $(du -h "$OUT" | cut -f1)"
