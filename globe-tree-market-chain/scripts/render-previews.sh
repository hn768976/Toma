#!/usr/bin/env bash
# Renders the 720p previews: Remotion -> PNG sequence (so single frames can be
# compared byte-for-byte), then ffmpeg -> H.264 / yuv420p / CRF 16 / 30fps.
# Usage: scripts/render-previews.sh [compositionId ...]
set -euo pipefail
cd "$(dirname "$0")/.."
SCALE=0.3333333333333333
declare -A NAME=(
  [KeywordGlobe-TechBlue]=KeywordGlobe_TechBlue
  [KeywordGlobe-BusinessGold]=KeywordGlobe_BusinessGold
  [CircuitTree-Blue]=CircuitTree_Blue
  [CircuitTree-EcoGreen]=CircuitTree_EcoGreen
  [MarketDashboard]=MarketDashboard
  [BlockchainPanels-IceBlue]=BlockchainPanels_IceBlue
  [BlockchainBuild-Teal]=BlockchainBuild_Teal
)
IDS=("$@")
[ ${#IDS[@]} -eq 0 ] && IDS=(KeywordGlobe-TechBlue KeywordGlobe-BusinessGold CircuitTree-Blue CircuitTree-EcoGreen MarketDashboard BlockchainPanels-IceBlue BlockchainBuild-Teal)
mkdir -p out/previews out/seq out/timing
for id in "${IDS[@]}"; do
  n=${NAME[$id]}
  if [ "${SKIP_DONE:-0}" = 1 ] && [ -f "out/timing/$id.txt" ]; then
    echo "$id: reusing existing sequence"
  else
    rm -rf "out/seq/$id"
    start=$(date +%s.%N)
    npx remotion render "$id" "out/seq/$id" --sequence --image-format=png --scale=$SCALE --concurrency=4 --timeout=180000 --log=error
    end=$(date +%s.%N)
    frames=$(find "out/seq/$id" -name '*.png' | wc -l)
    echo "$id frames=$frames seconds=$(echo "$end - $start" | bc)" | tee "out/timing/$id.txt"
  fi
  files=(out/seq/$id/*.png)
  first=$(basename "${files[0]}")
  pattern=$(echo "$first" | sed -E 's/[0-9]+\.png$//')
  digits=$(echo "$first" | sed -E 's/.*[^0-9]([0-9]+)\.png$/\1/' | tr -d '\n' | wc -c)
  ffmpeg -v error -y -framerate 30 -i "out/seq/$id/${pattern}%0${digits}d.png" \
    -c:v libx264 -preset slow -crf 16 -pix_fmt yuv420p -r 30 -an -movflags +faststart "out/previews/$n.mp4"
  case $id in CircuitTree*) sf=450 ;; BlockchainBuild*) sf=420 ;; *) sf=150 ;; esac
  cp "${files[$sf]}" "out/previews/${n}_still720.png"
done
