#!/bin/bash
# Packages each Remotion project (source, assets, configs, lockfile, README)
# into a ZIP, excluding installable/generated folders (node_modules, out, dist).
# Usage: qc/package_projects.sh <output-dir>
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${1:-$ROOT/deliverables}"
mkdir -p "$OUT"
for proj in contour-maze tile-wave; do
  zipfile="$OUT/${proj}_4K_remotion_project.zip"
  rm -f "$zipfile"
  (cd "$ROOT" && zip -r -X -q "$zipfile" "$proj" \
     -x "$proj/node_modules/*" "$proj/out/*" "$proj/dist/*" "$proj/.DS_Store")
  echo "wrote $zipfile"
done
