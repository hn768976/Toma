#!/bin/bash
# Render 720p previews: PNG sequence (out of order, several threads) -> H.264 mp4.
# Keeping the PNG sequence lets us compare frames byte-for-byte with cold stills.
# Usage: scripts/render-previews.sh [CompositionId ...]
set -e
cd "$(dirname "$0")/.."
SCALE=0.3333333333333333
IDS=${@:-"TopoTerrain-Teal TopoTerrain-Blue HeadlineWords-Tariffs HeadlineWords-Recession HeadlineWords-Inflation TickerFloor-Blue TrendRibbon-Multicolour"}
mkdir -p out/previews out/seq out/logs
npx remotion bundle --out-dir=out/bundle > out/logs/bundle.log 2>&1
for id in $IDS; do
  name=$(echo "$id" | sed 's/-/_/')
  rm -rf "out/seq/$id"
  start=$(date +%s)
  npx remotion render out/bundle "$id" "out/seq/$id" --sequence --image-format=png \
    --scale=$SCALE --gl=angle --concurrency=4 > "out/logs/render_$id.log" 2>&1
  end=$(date +%s)
  frames=$(ls "out/seq/$id" | wc -l)
  echo "$id frames=$frames seconds=$((end-start))" >> out/logs/render_times.txt
  first=$(ls "out/seq/$id" | head -1)
  pattern=$(echo "$first" | sed -E 's/[0-9]+\.png$//')
  digits=$(echo "$first" | sed -E 's/.*[^0-9]([0-9]+)\.png$/\1/' | tr -d '\n' | wc -c)
  ffmpeg -v error -y -framerate 30 -i "out/seq/$id/${pattern}%0${digits}d.png" \
    -c:v libx264 -preset slow -crf 16 -pix_fmt yuv420p -r 30 -an -movflags +faststart \
    "out/previews/$name.mp4"
  cp "out/seq/$id/$(ls out/seq/$id | sed -n 301p)" "out/previews/$name.png"
done
