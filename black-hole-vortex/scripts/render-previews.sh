#!/usr/bin/env bash
# Render the 720p previews (1280x720, H.264 yuv420p, CRF 16, 30 fps, no audio)
# plus a 720p PNG still of each composition into out/.
# usage: scripts/render-previews.sh [CompositionId ...]
set -euo pipefail
cd "$(dirname "$0")/.."
COMPS=("$@")
if [ ${#COMPS[@]} -eq 0 ]; then
  COMPS=(BlackHole-EdgeOnPink BlackHole-GoldFlare BlackHole-DiscSkim Vortex-PurpleEye Vortex-BlueFunnel Vortex-NebulaSwirl)
fi
mkdir -p out
for c in "${COMPS[@]}"; do
  name="${c/-/_}"
  start=$(date +%s)
  npx remotion render "$c" "out/${name}.mp4" \
    --scale=0.3333333333333333 --codec=h264 --crf=16 --pixel-format=yuv420p \
    --image-format=png --gl=angle --concurrency=1 --muted --log=error
  end=$(date +%s)
  echo "$c: $((end - start)) s total for 600 frames" | tee -a out/render-times.txt
  npx remotion still "$c" "out/${name}.png" --frame=300 --scale=0.3333333333333333 --gl=angle --log=error
done
