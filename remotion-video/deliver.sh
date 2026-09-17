#!/usr/bin/env bash
# Encodes the deliverables from the 4K PNG sequences produced by render-all.sh.
#
# Both outputs come straight off the lossless frames, so neither is a re-encode
# of the other. Downscaling 3840x2160 -> 1920x1080 with Lanczos averages four
# rendered pixels into every delivered one, which resolves the tube silhouettes
# better than any amount of MSAA at 1080p would.
set -euo pipefail
cd "$(dirname "$0")"

FPS=30
# Keep in step with GRADES in src/spiral-flow/palette.ts.
VARIANTS=(Violet Blue Emerald Ember)

mkdir -p out/master out/deliver

for VARIANT in "${VARIANTS[@]}"; do
  SRC="out/frames/$(echo "$VARIANT" | tr '[:upper:]' '[:lower:]')"
  [ -d "$SRC" ] || { echo "missing $SRC — run ./render-all.sh first" >&2; exit 1; }

  COUNT=$(find "$SRC" -name 'frame_*.png' | wc -l)
  [ "$COUNT" -eq 180 ] || { echo "$SRC has $COUNT frames, expected 180" >&2; exit 1; }

  # bt709 everywhere: these are smooth wide-area gradients, and an untagged
  # file gets guessed at differently by different players.
  TAGS=(-color_primaries bt709 -color_trc bt709 -colorspace bt709)

  ffmpeg -v error -y -framerate "$FPS" -i "$SRC/frame_%04d.png" \
    -vf "format=yuv420p" \
    -c:v libx264 -profile:v high -level 5.1 -preset slow -crf 15 \
    "${TAGS[@]}" -movflags +faststart -an \
    "out/master/SpiralFlow_4K_${VARIANT}.mp4"
  echo "wrote out/master/SpiralFlow_4K_${VARIANT}.mp4"

  ffmpeg -v error -y -framerate "$FPS" -i "$SRC/frame_%04d.png" \
    -vf "scale=1920:1080:flags=lanczos,format=yuv420p" \
    -c:v libx264 -profile:v high -level 4.0 -preset slow -crf 17 \
    -x264-params "keyint=60:min-keyint=30:bframes=3" \
    "${TAGS[@]}" -movflags +faststart -an \
    "out/deliver/SpiralFlow_1080p_${VARIANT}.mp4"
  echo "wrote out/deliver/SpiralFlow_1080p_${VARIANT}.mp4"
done
