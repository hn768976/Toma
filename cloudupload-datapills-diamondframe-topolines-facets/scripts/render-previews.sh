#!/usr/bin/env bash
# 720p previews: PNG sequence (lossless, used by the checks) -> H.264 mp4
# (CRF 16, yuv420p, 30 fps, no audio) + a 720p PNG still (frame 300).
# Usage: scripts/render-previews.sh [id ...]   (default: all eight)
set -euo pipefail
cd "$(dirname "$0")/.."
source scripts/ids.sh
IDS="${*:-$ALL_IDS}"
SCALE=0.3333333333333333
CONC="${CONC:-1}"
mkdir -p out/frames out/previews out/stills
[ "${NOBUNDLE:-0}" = 1 ] || npx remotion bundle --out-dir=build >/dev/null
for id in $IDS; do
  name=$(fname "$id")
  rm -rf "out/frames/$id"
  start=$(date +%s.%N)
  npx remotion render build "$id" "out/frames/$id" --sequence --image-format=png \
    --scale=$SCALE --concurrency="$CONC" --log=error
  end=$(date +%s.%N)
  secs=$(echo "$end - $start" | bc)
  echo "$id wall=${secs}s frames=600 conc=$CONC per_frame_wall=$(echo "scale=3; $secs/600" | bc)s" | tee -a out/render-times.txt
  ffmpeg -v error -y -framerate 30 -i "out/frames/$id/element-%03d.png" \
    -c:v libx264 -preset slow -crf 16 -pix_fmt yuv420p -r 30 -an -movflags +faststart \
    "out/previews/$name.mp4"
  cp "out/frames/$id/element-300.png" "out/stills/$name.png"
done
