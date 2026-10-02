#!/usr/bin/env bash
# Renders the 1080p previews.
#   1. Remotion renders every frame as a lossless PNG (--scale=0.5 -> 1920x1080).
#   2. ffmpeg encodes H.264 (libx264), yuv420p, 30 fps, CRF 16, no audio.
# Keeping the PNGs lets the determinism check compare frame 300 of the full
# render byte for byte against a cold single-frame still.
# Usage: scripts/render-previews.sh [CompositionId ...]   (default: all four)
set -euo pipefail
cd "$(dirname "$0")/.."
GL=${GL:-angle}
CONCURRENCY=${CONCURRENCY:-2}
OUT=${OUT:-renders}
COMPS=("$@")
if [ ${#COMPS[@]} -eq 0 ]; then
  COMPS=(ChipGrid-ShieldSweepTop ChipGrid-AttackPullback ChipGrid-AttackSpread ChipGrid-ShieldRecovery)
fi
mkdir -p "$OUT"
BUNDLE="$OUT/bundle"
rm -rf "$BUNDLE"
npx remotion bundle --out-dir="$BUNDLE" >/dev/null 2>&1
for COMP in "${COMPS[@]}"; do
  NAME=${COMP//-/_}
  FR="$OUT/frames/$COMP"
  rm -rf "$FR"
  START=$(date +%s)
  echo "[$(date -u +%T)] $COMP: rendering frames" >> "$OUT/render.log"
  npx remotion render "$BUNDLE" "$COMP" "$FR" --sequence --image-format=png \
    --scale=0.5 --gl="$GL" --concurrency="$CONCURRENCY" --timeout=300000 \
    > "$OUT/$COMP.render.txt" 2>&1
  MID=$(date +%s)
  ffmpeg -v error -y -framerate 30 -start_number 0 -i "$FR/element-%03d.png" \
    -c:v libx264 -preset slow -crf 16 -pix_fmt yuv420p -r 30 -an -movflags +faststart \
    "$OUT/$NAME.mp4"
  END=$(date +%s)
  echo "[$(date -u +%T)] $COMP: done; frames $((MID - START))s ($(awk "BEGIN{printf \"%.2f\", ($MID-$START)/450}") s/frame wall), encode $((END - MID))s" >> "$OUT/render.log"
done
echo "ALL DONE" >> "$OUT/render.log"
