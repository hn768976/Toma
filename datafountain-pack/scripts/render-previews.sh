#!/usr/bin/env bash
# Renders the 720p previews: a full PNG-sequence render through Remotion
# (--scale=1/3 → exactly 1280×720), then H.264 / yuv420p / CRF 16 / 30 fps,
# no audio. The PNG frames are kept so the determinism check can compare a
# cold single-frame still against the very frame used in the mp4.
# usage: scripts/render-previews.sh OUTDIR [Composition-Id ...]
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=${1:?outdir}; shift
IDS=("$@")
if [ ${#IDS[@]} -eq 0 ]; then
  IDS=(DataFountain-Story DataFountain-Loop CodePanels-Dark PastelSilk-PinkBlue PastelSilk-PeachMint TealHUD-Soft LiquidRipples-White LiquidRipples-Black)
fi
mkdir -p "$OUT/frames" "$OUT/previews" "$OUT/stills"
for ID in "${IDS[@]}"; do
  NAME=${ID//-/_}
  rm -rf "$OUT/frames/$NAME"
  t0=$(date +%s.%N)
  npx remotion render "$ID" "$OUT/frames/$NAME" --sequence --image-format=png \
    --scale=0.3333333333333333 --concurrency=2 --log=error
  t1=$(date +%s.%N)
  ffmpeg -v error -y -framerate 30 -i "$OUT/frames/$NAME/element-%03d.png" \
    -c:v libx264 -preset slow -crf 16 -pix_fmt yuv420p -r 30 -an -movflags +faststart \
    "$OUT/previews/$NAME.mp4"
  N=$(ls "$OUT/frames/$NAME" | wc -l)
  MID=$(printf "%03d" $((N / 2)))
  cp "$OUT/frames/$NAME/element-$MID.png" "$OUT/stills/$NAME.png"
  python3 -c "print('$NAME: %d frames in %.0fs wall (concurrency 2) = %.2fs/frame' % ($N, $t1-$t0, ($t1-$t0)/$N))" | tee -a "$OUT/render-times.txt"
done
