#!/usr/bin/env bash
# 1080p previews: full PNG-sequence render (--scale=0.5 of the 3840×2160
# compositions), then H.264 CRF 16 yuv420p 30 fps, no audio.
# Keeps frame 150 of the full render for the determinism check and one PNG still.
# Usage: scripts/render-previews.sh [filter-regex]
set -euo pipefail
cd "$(dirname "$0")/.."
FILTER=${1:-.}
CONC=${CONCURRENCY:-2}
mkdir -p out renders/frame150 out/stills-1080p
declare -A STILL=( [GalaxySpiral]=120 [EnergyOrb]=150 [ParticleWorldMap]=420 [CellDivision]=300 [NebulaCore]=200 )
grep -E "$FILTER" scripts/comps.txt | while read -r ID NAME FRAMES KIND; do
  SEQ="renders/seq/$NAME"
  rm -rf "$SEQ"
  START=$(date +%s)
  npx remotion render "$ID" "$SEQ" --sequence --scale=0.5 --image-format=png --concurrency="$CONC" --log=error < /dev/null
  END=$(date +%s)
  echo "$ID: $FRAMES frames in $((END - START)) s (concurrency $CONC)" | tee -a renders/render-times.txt
  ffmpeg -nostdin -v error -y -framerate 30 -i "$SEQ/element-%03d.png" \
    -vf "scale=out_color_matrix=bt709:out_range=tv,format=yuv420p" \
    -c:v libx264 -preset slow -crf 16 -pix_fmt yuv420p \
    -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv \
    -r 30 -an -movflags +faststart "out/$NAME.mp4"
  cp "$SEQ/element-150.png" "renders/frame150/${NAME}_full.png"
  S=${STILL[${ID%%-*}]}
  cp "$SEQ/element-$(printf %03d "$S").png" "out/stills-1080p/${NAME}.png"
  rm -rf "$SEQ"
done
