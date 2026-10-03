#!/usr/bin/env bash
# 720p previews: Remotion renders a lossless PNG sequence (kept in out/frames/<id>
# for the determinism/loop checks), then ffmpeg encodes H.264 CRF 16 yuv420p.
# Usage: scripts/render-previews.sh [compositionId ...]
set -euo pipefail
cd "$(dirname "$0")/.."
SCALE=0.3333333333333333
ids=("$@")
[ ${#ids[@]} -eq 0 ] && ids=(GlobalMarketsMap CandleChartFlow-Blue CandleChartFlow-Gold)
mkdir -p out/frames
for id in "${ids[@]}"; do
  name=${id/-/_}
  rm -rf "out/frames/$id"
  t0=$(date +%s.%N)
  npx remotion render "$id" "out/frames/$id" --sequence --image-format=png --scale=$SCALE --gl=angle > "out/$id.log" 2>&1
  t1=$(date +%s.%N)
  ffmpeg -v error -y -framerate 30 -i "out/frames/$id/element-%03d.png" \
    -c:v libx264 -preset slow -crf 16 -pix_fmt yuv420p \
    -vf "scale=out_color_matrix=bt709:out_range=tv" -colorspace bt709 -color_primaries bt709 -color_trc bt709 \
    -movflags +faststart -an "out/$name.mp4"
  echo "$id render $(echo "$t1-$t0" | bc) s for 600 frames ($(grep -a -o 'Concurrency *[0-9]*x' "out/$id.log" | head -1))" | tee -a out/timings.txt
done
