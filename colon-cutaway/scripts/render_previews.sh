#!/usr/bin/env bash
# Render the 1080p previews: PNG frame sequence (kept for the determinism
# check) -> H.264 / yuv420p / CRF 16 / 30 fps, no audio.
# usage: scripts/render_previews.sh [compId ...]
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=${OUT:-out}
CONC=${CONC:-2}
comps=("$@")
[ ${#comps[@]} -eq 0 ] && comps=(Colon-ConstipationRelief Colon-HealthyFlora Colon-InflammationRelief)
mkdir -p "$OUT"
for id in "${comps[@]}"; do
  name=${id/-/_}
  rm -rf "$OUT/frames/$id"
  t0=$(date +%s)
  npx remotion render "$id" "$OUT/frames/$id" --sequence --image-format=png --scale=0.5 --concurrency="$CONC" --log=error
  t1=$(date +%s)
  n=$(ls "$OUT/frames/$id" | wc -l)
  first=$(ls "$OUT/frames/$id" | sort | head -1)
  pattern=$(echo "$first" | sed -E 's/[0-9]+\.png$//')
  digits=$(echo "$first" | sed -E 's/^.*-([0-9]+)\.png$/\1/' | tr -d '\n' | wc -c)
  ffmpeg -v error -y -framerate 30 -start_number 0 -i "$OUT/frames/$id/${pattern}%0${digits}d.png" \
    -c:v libx264 -preset slow -crf 16 -pix_fmt yuv420p -r 30 -an -movflags +faststart "$OUT/$name.mp4"
  echo "$id: $n frames in $((t1 - t0)) s = $(echo "scale=2; ($t1 - $t0) / $n" | bc) s/frame (concurrency $CONC)" | tee -a "$OUT/render_times.txt"
done
