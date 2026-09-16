#!/usr/bin/env bash
# Derives the 1080p deliverables from the 4K masters produced by render-all.sh.
#
# Downscaling 3840x2160 -> 1920x1080 with Lanczos means every output pixel is an
# average of four rendered ones, which is cheaper and cleaner than any amount of
# MSAA at 1080p, and it keeps the two deliverables pixel-consistent with the 4K
# master rather than being a separate render.
set -euo pipefail
cd "$(dirname "$0")"

mkdir -p out/deliver

for VARIANT in Violet Blue; do
  SRC="out/master/SpiralFlow_4K_${VARIANT}.mp4"
  DST="out/deliver/SpiralFlow_1080p_${VARIANT}.mp4"
  [ -f "$SRC" ] || { echo "missing $SRC — run ./render-all.sh first" >&2; exit 1; }

  ffmpeg -v error -y -i "$SRC" \
    -vf "scale=1920:1080:flags=lanczos,format=yuv420p" \
    -c:v libx264 -profile:v high -level 4.0 -preset slow -crf 17 \
    -x264-params "keyint=60:min-keyint=30:bframes=3" \
    -color_primaries bt709 -color_trc bt709 -colorspace bt709 \
    -movflags +faststart -an "$DST"
  echo "wrote $DST"
done

# Re-tag the masters as bt709 limited range so they grade predictably in an NLE.
for VARIANT in Violet Blue; do
  SRC="out/master/SpiralFlow_4K_${VARIANT}.mp4"
  TMP="out/master/.${VARIANT}.tmp.mp4"
  ffmpeg -v error -y -i "$SRC" -vf "format=yuv420p" \
    -c:v libx264 -profile:v high -level 5.1 -preset slow -crf 15 \
    -color_primaries bt709 -color_trc bt709 -colorspace bt709 \
    -movflags +faststart -an "$TMP"
  mv "$TMP" "$SRC"
  echo "re-tagged $SRC"
done
