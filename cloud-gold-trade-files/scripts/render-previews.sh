#!/usr/bin/env bash
# Render the 720p previews of every composition (or the ones named as args).
#
# Each composition is rendered by Remotion as a PNG sequence (kept, so frames
# can be compared byte for byte with single-frame stills), then encoded with
# ffmpeg to H.264 / yuv420p / CRF 16 / 30 fps, BT.709 tagged, no audio.
# Render times per composition are appended to renders/times.txt.
#
# Usage: scripts/render-previews.sh [CompId ...]
set -euo pipefail
cd "$(dirname "$0")/.."

SCALE=0.3333333333333333
CONC=${CONC:-2}
ALL=(CloudServers-Blue CloudServers-Violet LightTrails-Blue LightTrails-RedOrange
     GoldBarChart-Rising GoldBarChart-Falling TradeWar-USA-China
     FileWave-Documents FileWave-Folders)
if [ $# -gt 0 ]; then COMPS=("$@"); else COMPS=("${ALL[@]}"); fi

mkdir -p renders/frames
npx remotion bundle --out-dir=build >/dev/null

for comp in "${COMPS[@]}"; do
  name=${comp//-/_}
  dir=renders/frames/$name
  rm -rf "$dir"
  start=$(date +%s.%N)
  npx remotion render build "$comp" "$dir" --sequence --image-format=png \
    --scale=$SCALE --gl=angle --concurrency="$CONC" --log=error
  end=$(date +%s.%N)
  n=$(ls "$dir" | wc -l)
  echo "$comp frames=$n seconds=$(echo "$end - $start" | bc)" | tee -a renders/times.txt
  ffmpeg -v error -y -framerate 30 -pattern_type glob -i "$dir/*.png" \
    -vf "scale=out_color_matrix=bt709:out_range=tv,format=yuv420p" \
    -c:v libx264 -preset slow -crf 16 -r 30 -an \
    -color_primaries bt709 -color_trc bt709 -colorspace bt709 \
    -movflags +faststart "renders/$name.mp4"
done
