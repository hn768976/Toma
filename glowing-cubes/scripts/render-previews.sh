#!/usr/bin/env bash
# Renders the 1080p previews: Remotion renders a lossless PNG sequence at
# --scale=0.5 (1920×1080), then ffmpeg encodes H.264 / yuv420p / CRF 16 / 30 fps.
# Keeping the PNGs lets the verify step compare frame 150 of the full render
# byte-for-byte with a cold single-frame render.
#
#   bash scripts/render-previews.sh [CompositionId ...]
set -euo pipefail
cd "$(dirname "$0")/.."
COMPS=("$@")
if [ ${#COMPS[@]} -eq 0 ]; then
  COMPS=(CubeCluster-Green CubeCluster-Violet CubeCluster-Blue CubeAssembly-Blue CubeAssembly-Violet CubeAssembly-Green)
fi
mkdir -p out/frames out/previews out/logs
for id in "${COMPS[@]}"; do
  name="${id/-/_}"
  rm -rf "out/frames/$id"
  start=$(date +%s)
  npx remotion render "$id" "out/frames/$id" --sequence --image-format=png --scale=0.5 --concurrency=3 \
    > "out/logs/$id.render.log" 2>&1
  mid=$(date +%s)
  ffmpeg -v error -y -framerate 30 -start_number 0 -i "out/frames/$id/element-%03d.png" \
    -vf "scale=out_color_matrix=bt709:out_range=tv:flags=accurate_rnd+full_chroma_int" \
    -c:v libx264 -preset slow -crf 16 -pix_fmt yuv420p -r 30 \
    -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv \
    -movflags +faststart -an "out/previews/$name.mp4"
  end=$(date +%s)
  frames=$(ls "out/frames/$id" | wc -l)
  echo "$id frames=$frames render_s=$((mid - start)) encode_s=$((end - mid)) s_per_frame=$(echo "scale=2; ($mid - $start) / $frames" | bc)" | tee -a out/logs/timing.txt
done
