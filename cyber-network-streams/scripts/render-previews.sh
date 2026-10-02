#!/usr/bin/env bash
# Renders the 720p previews: PNG frame sequence at --scale=1/3 (1280×720),
# then H.264 / yuv420p / CRF 16 / 30 fps with ffmpeg. Keeps the PNGs so a
# single cold-rendered frame can be compared byte for byte.
#   scripts/render-previews.sh [CompositionId ...]
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=${OUT:-out/previews}
mkdir -p "$OUT"
declare -A NAME=(
  [CyberFlythrough]=CyberFlythrough
  [NetworkHub-DarkBlue]=NetworkHub_DarkBlue
  [NetworkHub-Light]=NetworkHub_Light
  [LightStreams-Blue]=LightStreams_Blue
  [LightStreams-Amber]=LightStreams_Amber
  [DataBurst]=DataBurst
  [FibreStrands-Blue]=FibreStrands_Blue
  [FibreStrands-Gold]=FibreStrands_Gold
  [BigDataHUD]=BigDataHUD
)
IDS=("$@")
[ ${#IDS[@]} -eq 0 ] && IDS=(CyberFlythrough NetworkHub-DarkBlue NetworkHub-Light LightStreams-Blue LightStreams-Amber DataBurst FibreStrands-Blue FibreStrands-Gold BigDataHUD)
npx remotion bundle --out-dir=out/bundle >/dev/null
for id in "${IDS[@]}"; do
  n=${NAME[$id]}
  rm -rf "$OUT/frames/$n"
  start=$(date +%s)
  npx remotion render out/bundle "$id" "$OUT/frames/$n" --sequence --image-format=png \
    --scale=0.3333333333333333 --gl=angle --concurrency=${CONCURRENCY:-2} --log=error
  end=$(date +%s)
  first=$(ls "$OUT/frames/$n" | sort | head -1)
  PADW=$(echo "$first" | sed -E 's/^element-([0-9]+)\.png$/\1/' | tr -d '\n' | wc -c)
  ffmpeg -v error -y -framerate 30 -i "$OUT/frames/$n/element-%0${PADW}d.png" \
    -c:v libx264 -preset slow -crf 16 -x264-params aq-mode=3:aq-strength=1.6:fast-pskip=0 -pix_fmt yuv420p -r 30 -an -movflags +faststart "$OUT/$n.mp4"
  frames=$(ls "$OUT/frames/$n" | wc -l)
  echo "$id: $frames frames in $((end - start)) s" | tee -a "$OUT/timings.txt"
done
