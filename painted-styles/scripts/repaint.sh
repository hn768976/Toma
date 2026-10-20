#!/usr/bin/env bash
# Repaint one style from scratch: clear its caches, paint 4K layers (+ draw-on frames for draw-on styles), 6 stills.
#   scripts/repaint.sh <key> [jobs]
set -euo pipefail
cd "$(dirname "$0")/.."
k=$1; j=${2:-2}
rm -rf build/prefix/$k build/dense/$k remotion/public/layers/$k remotion/public/drawon/$k
.venv/bin/python scripts/paint.py layers --keys $k --jobs $j --drawon watercolour,inkwash,stainedglass
.venv/bin/python scripts/paint.py stills --keys $k --jobs $j
