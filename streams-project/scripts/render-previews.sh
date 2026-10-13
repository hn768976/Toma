#!/usr/bin/env bash
# 720p previews: render a PNG sequence at --scale=1/3, encode H.264 CRF 16.
# Usage: scripts/render-previews.sh [CompositionId ...]   (default: all 8)
set -euo pipefail
cd "$(dirname "$0")/.."
SCALE=0.3333333333333333
CONC=${CONCURRENCY:-2}
ALL="LightStreams-CoralViolet LightStreams-TealBlue ShieldDome-Story ShieldDome-HoldLoop NeonWaves-PinkBlue PillSpill-Blue PillSpill-WhiteOrange DataStrands-BlueOrange"
COMPS=${*:-$ALL}
mkdir -p out/previews out/frames
[ -d out/bundle ] || npx remotion bundle src/index.ts --out-dir=out/bundle
for c in $COMPS; do
  file=$(echo "$c" | sed 's/-/_/')
  rm -rf "out/frames/$c"
  start=$(date +%s.%N)
  npx remotion render out/bundle "$c" "out/frames/$c" --sequence --image-format=png \
    --scale=$SCALE --concurrency=$CONC --log=error
  end=$(date +%s.%N)
  n=$(ls "out/frames/$c" | wc -l)
  echo "$c frames=$n seconds=$(echo "$end-$start" | bc) per_frame=$(echo "($end-$start)/$n" | bc -l | cut -c1-6)" | tee -a out/render-times.txt
  first=$(ls "out/frames/$c" | head -1)
  pattern=$(echo "$first" | sed -E 's/[0-9]+\.png$//')
  digits=$(echo "$first" | sed -E 's/.*[^0-9]([0-9]+)\.png$/\1/' | wc -c)
  ffmpeg -v error -y -framerate 30 -i "out/frames/$c/${pattern}%0$((digits-1))d.png" \
    -c:v libx264 -preset slow -crf 16 -pix_fmt yuv420p -r 30 -an -movflags +faststart \
    "out/previews/$file.mp4"
done
