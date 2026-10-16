#!/usr/bin/env bash
# Renders 720p previews: Remotion renders a lossless PNG sequence (the "full render"),
# ffmpeg encodes it (H.264, yuv420p, CRF 16, 30fps, no audio). Keeps the PNGs only
# until the determinism check has read them (KEEP_FRAMES=1).
# usage: scripts/render-previews.sh [id ...]   (default: all 8)
set -euo pipefail
cd "$(dirname "$0")/.."
IDS=("$@")
if [ ${#IDS[@]} -eq 0 ]; then
  IDS=(HazardGlitch_Radiation HazardGlitch_Biohazard BrainBoard_Blue PhoneHologram_Blue PhoneHologram_Violet MapPanels_Blue HUDFlythrough_Violet HUDFlythrough_Cyan)
fi
SCALE=${SCALE:-0.3333333333333333}
CONC=${CONCURRENCY:-2}
mkdir -p renders/frames renders/previews renders/stills renders/logs
for ID in "${IDS[@]}"; do
  COMP=${ID//_/-}
  OUT=renders/frames/$ID
  rm -rf "$OUT"
  T0=$(date +%s.%N)
  npx remotion render src/index.ts "$COMP" "$OUT" --sequence --image-format=png \
    --scale="$SCALE" --concurrency="$CONC" --log=error > "renders/logs/$ID.log" 2>&1
  T1=$(date +%s.%N)
  N=$(ls "$OUT" | wc -l)
  FIRST=$(ls "$OUT" | head -1)
  PATTERN=$(echo "$FIRST" | sed -E 's/[0-9]+\.png$//')
  DIGITS=$(echo "$FIRST" | sed -E 's/.*[^0-9]([0-9]+)\.png$/\1/' | tr -d '\n' | wc -c)
  ffmpeg -v error -y -framerate 30 -i "$OUT/${PATTERN}%0${DIGITS}d.png" \
    -c:v libx264 -preset slow -crf 16 -pix_fmt yuv420p -r 30 -an -movflags +faststart \
    "renders/previews/$ID.mp4"
  MID=$(( N / 2 ))
  cp "$OUT/$(printf "${PATTERN}%0${DIGITS}d.png" $MID)" "renders/stills/$ID.png"
  echo "$ID frames=$N seconds=$(echo "$T1 - $T0" | bc) per_frame=$(echo "scale=3; ($T1 - $T0) / $N" | bc) concurrency=$CONC" | tee -a renders/logs/timings.txt
  if [ "${KEEP_FRAMES:-0}" != "1" ]; then rm -rf "$OUT"; fi
done
