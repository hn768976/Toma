#!/usr/bin/env bash
# 720p previews of all 8 compositions.
# Renders each composition as a full PNG sequence with Remotion (out-of-order,
# multi-threaded), then encodes it with ffmpeg: H.264, yuv420p, 30 fps, CRF 16.
# The PNG sequence is kept so frame 200 can be compared byte-for-byte against
# a cold `remotion still` (determinism check).
set -euo pipefail
cd "$(dirname "$0")/.."
SCALE=0.3333333333333333
OUT=out/previews
mkdir -p "$OUT"
declare -A NAMES=(
  [GlitterSmoke-Blue]=GlitterSmoke_Blue
  [GlitterSmoke-VioletGold]=GlitterSmoke_VioletGold
  [NeonPolygonFrame]=NeonPolygonFrame
  [CrowdSpotlight-Blue]=CrowdSpotlight_Blue
  [CrowdSpotlight-Gold]=CrowdSpotlight_Gold
  [AIBrainPaths]=AIBrainPaths
  [GlassTwist-IceBlue]=GlassTwist_IceBlue
  [GlassTwist-Blush]=GlassTwist_Blush
)
COMPS=("$@")
if [ ${#COMPS[@]} -eq 0 ]; then COMPS=("${!NAMES[@]}"); fi
for id in "${COMPS[@]}"; do
  name=${NAMES[$id]}
  seq="out/seq/$name"
  rm -rf "$seq"; mkdir -p "$seq"
  start=$(date +%s)
  npx remotion render "$id" "$seq" --sequence --image-format=png --scale=$SCALE --log=error
  end=$(date +%s)
  n=$(ls "$seq" | wc -l)
  echo "$id: $n frames in $((end-start)) s ($(echo "scale=3; ($end-$start)/$n" | bc) s/frame)" | tee -a out/render-times.txt
  first=$(ls "$seq" | head -1)
  pattern=$(echo "$first" | sed -E 's/[0-9]+\.png$/%0'$(echo "$first" | sed -E 's/.*[^0-9]([0-9]+)\.png$/\1/' | tr -d '\n' | wc -c)'d.png/')
  ffmpeg -v error -y -framerate 30 -i "$seq/$pattern" -c:v libx264 -preset slow -crf 16 -pix_fmt yuv420p -r 30 -an -movflags +faststart "$OUT/$name.mp4"
  # 720p still (middle frame)
  mid=$(ls "$seq" | sed -n "$((n/2))p")
  cp "$seq/$mid" "$OUT/$name.png"
done
