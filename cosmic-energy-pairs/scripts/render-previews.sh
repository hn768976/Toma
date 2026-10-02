#!/usr/bin/env bash
# Full PNG-sequence render, then H.264 CRF 16 yuv420p 30 fps, no audio.
# Default SCALE=0.5 → 1080p previews; SCALE=1 OUT=out/4k → 4K masters.
# Keeps frame 150 of the full render for the determinism check and one PNG still.
# Usage: scripts/render-previews.sh [filter-regex]
set -euo pipefail
cd "$(dirname "$0")/.."
FILTER=${1:-.}
CONC=${CONCURRENCY:-2}
SCALE=${SCALE:-0.5}
OUT=${OUT:-out}
mkdir -p "$OUT" renders/frame150 "$OUT/stills"
declare -A STILL=( [GalaxySpiral]=120 [EnergyOrb]=150 [ParticleWorldMap]=420 [CellDivision]=300 [NebulaCore]=200 )
grep -E "$FILTER" scripts/comps.txt | while read -r ID NAME FRAMES KIND; do
  SEQ="renders/seq/$NAME"
  rm -rf "$SEQ"
  START=$(date +%s)
  npx remotion render "$ID" "$SEQ" --sequence --scale="$SCALE" --image-format=png --concurrency="$CONC" --log=error < /dev/null
  END=$(date +%s)
  echo "$ID: $FRAMES frames in $((END - START)) s (concurrency $CONC)" | tee -a renders/render-times.txt
  # Looks with film grain (1, 3, 5): -tune grain stops x264 from quantising the
  # 2% grain away in near-black areas (which otherwise re-exposes banding).
  TUNE=(); case "$ID" in GalaxySpiral*|ParticleWorldMap*|NebulaCore*) TUNE=(-tune grain);; esac
  ffmpeg -nostdin -v error -y -framerate 30 -i "$SEQ/element-%03d.png" \
    -vf "scale=out_color_matrix=bt709:out_range=tv,format=yuv420p" \
    -c:v libx264 -preset slow -crf 16 "${TUNE[@]}" -pix_fmt yuv420p \
    -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv \
    -r 30 -an -movflags +faststart "$OUT/$NAME.mp4"
  [ "$SCALE" = 0.5 ] && cp "$SEQ/element-150.png" "renders/frame150/${NAME}_full.png"
  S=${STILL[${ID%%-*}]}
  cp "$SEQ/element-$(printf %03d "$S").png" "$OUT/stills/${NAME}.png"
  rm -rf "$SEQ"
done
