#!/usr/bin/env bash
# Zip the project for delivery: source, city generator, pinned package.json/lock, README, fonts.
# Leaves out node_modules, .git, refs/, render output (out/, previews/) and any zip.
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=${1:-../gps-tracking-map-hud-project.zip}
rm -f "$OUT"
zip -r -q "$OUT" . -x 'node_modules/*' '.git/*' 'refs/*' 'out/*' 'previews/*' '*.zip' 'scripts/env.sh' '.remotion/*'
unzip -l "$OUT" | tail -1
