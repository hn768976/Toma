#!/usr/bin/env bash
# Encodes the videos from the PNG sequences produced by render-all.sh.
#
# The source width decides what comes out:
#   3840 wide -> a 4K master plus a Lanczos-downscaled 1080p deliverable, both
#                straight off the lossless frames so neither is a re-encode of
#                the other. The downscale averages four rendered pixels into
#                every delivered one, which resolves the tube silhouettes
#                better than any amount of MSAA at 1080p would.
#   1920 wide -> the 1080p deliverable alone, encoded as rendered.
set -euo pipefail
cd "$(dirname "$0")"

FPS=30
# Keep in step with GRADES in src/spiral-flow/palette.ts.
VARIANTS=(Violet Blue Emerald Ember)

mkdir -p out/deliver

for VARIANT in "${VARIANTS[@]}"; do
  SRC="out/frames/$(echo "$VARIANT" | tr '[:upper:]' '[:lower:]')"
  [ -d "$SRC" ] || { echo "missing $SRC — run ./render-all.sh first" >&2; exit 1; }

  COUNT=$(find "$SRC" -name 'frame_*.png' | wc -l)
  [ "$COUNT" -eq 180 ] || { echo "$SRC has $COUNT frames, expected 180" >&2; exit 1; }

  WIDTH=$(ffprobe -v error -show_entries stream=width -of csv=p=0 "$SRC/frame_0000.png")

  # bt709 everywhere: these are smooth wide-area gradients, and an untagged file
  # gets guessed at differently by different players.
  TAGS=(-color_primaries bt709 -color_trc bt709 -colorspace bt709)

  if [ "$WIDTH" -eq 3840 ]; then
    mkdir -p out/master
    ffmpeg -v error -y -framerate "$FPS" -i "$SRC/frame_%04d.png" \
      -vf "format=yuv420p" \
      -c:v libx264 -profile:v high -level 5.1 -preset slow -crf 15 \
      "${TAGS[@]}" -movflags +faststart -an \
      "out/master/SpiralFlow_4K_${VARIANT}.mp4"
    echo "wrote out/master/SpiralFlow_4K_${VARIANT}.mp4"
    SCALE="scale=1920:1080:flags=lanczos,format=yuv420p"
    # The downscale averages the debanding dither 4:1 along with everything
    # else, which leaves little for the encoder to chew on.
    CRF=17
  else
    SCALE="format=yuv420p"
    # Rendered at 1080p, the dither arrives at full per-pixel strength and is
    # expensive: the same CRF that costs 3 MB downscaled costs 20 MB here. CRF
    # 20 is the point where the file comes back to a sane size while the dither
    # still survives quantisation -- past it the encoder smooths the dither
    # away and the banding it exists to prevent starts to show.
    CRF=20
  fi

  ffmpeg -v error -y -framerate "$FPS" -i "$SRC/frame_%04d.png" \
    -vf "$SCALE" \
    -c:v libx264 -profile:v high -level 4.0 -preset slow -crf "$CRF" \
    -x264-params "keyint=60:min-keyint=30:bframes=3" \
    "${TAGS[@]}" -movflags +faststart -an \
    "out/deliver/SpiralFlow_1080p_${VARIANT}.mp4"
  echo "wrote out/deliver/SpiralFlow_1080p_${VARIANT}.mp4"
done
