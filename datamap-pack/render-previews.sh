#!/bin/bash
# Full 720p render of each composition as a lossless PNG sequence (kept for
# the determinism check), then encoded to the preview mp4:
# 1280x720, H.264 (libx264), yuv420p, 30fps, CRF 16, no audio.
# usage: ./render-previews.sh [CompId ...]   (default: all seven)
set -e
cd "$(dirname "$0")"
COMPS=${@:-DataMap-Blue PlexusGlobe-Navy CircuitWarp-Violet SoftGradient-Lime SoftGradient-Peach WirePeaks-White WirePeaks-Cyan}
mkdir -p out/previews out/stills out/frames
npx remotion bundle src/index.ts --out-dir=out/bundle >/dev/null 2>&1
for c in $COMPS; do
  f=${c/-/_}
  rm -rf "out/frames/$f"
  s=$(date +%s.%N)
  npx remotion render out/bundle "$c" "out/frames/$f" --sequence --image-format=png \
    --scale=0.3333333333333333 --concurrency=2 >/dev/null 2>&1
  e=$(date +%s.%N)
  echo "$c frames=600 render_s=$(echo "$e-$s" | bc)" | tee -a out/previews/timing.log
  ffmpeg -v error -y -framerate 30 -i "out/frames/$f/element-%03d.png" -c:v libx264 -crf 16 \
    -pix_fmt yuv420p -r 30 -movflags +faststart -an "out/previews/$f.mp4"
  cp "out/frames/$f/element-300.png" "out/stills/$f.png"
done
