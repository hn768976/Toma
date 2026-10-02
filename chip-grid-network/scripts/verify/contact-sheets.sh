#!/usr/bin/env bash
# Verify-loop steps 3 and 5: contact sheets taken from the ENCODED mp4.
#   <name>_every10.png : every 10th frame (45 tiles, 9 x 5, row-major: tile k is
#                        frame 10k), for stepping through the spread
#   <name>_five.png    : five evenly spaced frames (0, 112, 224, 336, 449)
# Usage: scripts/verify/contact-sheets.sh renders/ChipGrid_X.mp4 [outdir]
set -euo pipefail
VIDEO=$1
OUT=${2:-$(dirname "$VIDEO")/verify}
NAME=$(basename "$VIDEO" .mp4)
mkdir -p "$OUT"
# every 10th frame, 9 x 5 grid of 384x216 tiles
ffmpeg -v error -y -i "$VIDEO" \
  -vf "select='not(mod(n\,10))',scale=384:216,tile=9x5:padding=4:color=black" \
  -frames:v 1 -vsync 0 "$OUT/${NAME}_every10.png"
# five evenly spaced frames, 2 x 3 grid of 960x540 tiles (last tile empty)
ffmpeg -v error -y -i "$VIDEO" \
  -vf "select='eq(n\,0)+eq(n\,112)+eq(n\,224)+eq(n\,336)+eq(n\,449)',scale=960:540,tile=3x2:padding=4:color=black" \
  -frames:v 1 -vsync 0 "$OUT/${NAME}_five.png"
echo "$OUT/${NAME}_every10.png"
echo "$OUT/${NAME}_five.png"
