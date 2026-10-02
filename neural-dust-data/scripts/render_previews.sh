#!/usr/bin/env bash
# Render 720p previews: PNG sequence via Remotion (scale 1/3 of 3840x2160), then H.264 CRF 16 yuv420p 30fps.
# The PNG sequence is kept so frame 300 can be compared byte-for-byte with a cold-start still (step 4).
# usage: scripts/render_previews.sh [compId:OutName ...]
set -e
cd "$(dirname "$0")/.."
ALL="NeuralLayers-IceBlue:NeuralLayers_IceBlue NeuralLayers-Violet:NeuralLayers_Violet DustSmoke-Sepia:DustSmoke_Sepia DustSmoke-Teal:DustSmoke_Teal DustSmoke-WhiteOnBlack:DustSmoke_WhiteOnBlack DataPanels-TealRed:DataPanels_TealRed NightSkyMeteor:NightSkyMeteor IconNetwork:IconNetwork"
LIST=${*:-$ALL}
CONC=${CONC:-3}
mkdir -p out/frames out/previews out/timing
for pair in $LIST; do
  id=${pair%%:*}; name=${pair##*:}
  rm -rf "out/frames/$id"
  start=$(date +%s.%N)
  npx remotion render out/bundle "$id" "out/frames/$id" --sequence --image-format=png \
    --scale=0.3333333333333333 --gl=angle --concurrency=$CONC --log=error >/dev/null
  end=$(date +%s.%N)
  n=$(ls out/frames/$id | wc -l)
  echo "$id frames=$n wall=$(echo "$end - $start" | bc)s concurrency=$CONC" | tee out/timing/$id.txt
  first=$(ls out/frames/$id | head -1)
  pattern=$(echo "$first" | sed -E 's/[0-9]+\.png$//')
  digits=$(echo "$first" | sed -E 's/.*[^0-9]([0-9]+)\.png$/\1/' | wc -c); digits=$((digits-1))
  ffmpeg -v error -y -framerate 30 -i "out/frames/$id/${pattern}%0${digits}d.png" \
    -c:v libx264 -preset slow -crf 16 -pix_fmt yuv420p -r 30 -an -movflags +faststart "out/previews/$name.mp4"
done
