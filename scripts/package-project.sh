#!/usr/bin/env bash
# Zips the Remotion project for handoff: source, config and lockfile, without
# node_modules, rendered output or bundler artifacts. Run from the repo root.
set -euo pipefail

OUT=${1:-dist/neon-layers-project.zip}
mkdir -p "$(dirname "$OUT")"
rm -f "$OUT"

zip -r -q "$OUT" remotion-video \
  -x 'remotion-video/node_modules/*' \
  -x 'remotion-video/out/*' \
  -x 'remotion-video/build/*' \
  -x 'remotion-video/.git/*' \
  -x '*/.DS_Store'

echo "Wrote $OUT ($(du -h "$OUT" | cut -f1))"
