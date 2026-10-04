#!/usr/bin/env bash
# Renders 720p previews: PNG sequence (Remotion, out of order, several tabs),
# then H.264 / yuv420p / CRF 16 with ffmpeg. Keeps frame 300 as PNG for the
# determinism check and a 720p still per composition.
#   scripts/render-previews.sh [CompositionId ...]
set -euo pipefail
cd "$(dirname "$0")/.."
GL="${GL:-angle}"
CONC="${CONC:-2}"
OUT="${OUT:-out}"
ALL=(VintageMap-Europe VintageMap-NorthAmerica VintageMap-World CreamSwirl-Cream CreamSwirl-Blush CreamSwirl-Caramel ParticleSmoke-Blue ParticleSmoke-Gold)
IDS=("$@")
[ ${#IDS[@]} -eq 0 ] && IDS=("${ALL[@]}")
mkdir -p "$OUT/previews" "$OUT/stills" "$OUT/frame300" "$OUT/logs"
for id in "${IDS[@]}"; do
  name="${id/-/_}"
  frames="$OUT/frames/$name"
  start=$(date +%s)
  if [ "${RESUME:-0}" = 1 ] && [ -d "$frames" ] && [ "$(find "$frames" -name '*.png' | wc -l)" -ge 600 ]; then
    echo "$id: reusing rendered frames in $frames"
  else
  rm -rf "$frames"
  npx remotion render "$id" "$frames" --sequence --image-format=png \
    --scale=0.3333333333333333 --gl="$GL" --concurrency="$CONC" --log=info > "$OUT/logs/$name.log" 2>&1
  fi
  end=$(date +%s)
  files=("$frames"/*.png)
  n=${#files[@]}
  first="${files[0]##*/}"
  digits=$(echo "$first" | sed -E 's/^[^0-9]*([0-9]+)\.png$/\1/')
  pattern="$frames/$(echo "$first" | sed -E 's/[0-9]+\.png$//')%0${#digits}d.png"
  ffmpeg -v error -y -framerate 30 -start_number 0 -i "$pattern" -c:v libx264 -preset slow -tune grain -crf 16 \
    -pix_fmt yuv420p -r 30 -an -movflags +faststart "$OUT/previews/$name.mp4"
  f300=$(printf "$pattern" 300)
  cp "$f300" "$OUT/frame300/$name.png"
  cp "$f300" "$OUT/stills/$name.png"
  echo "$id: $n frames in $((end - start)) s (concurrency $CONC) -> $OUT/previews/$name.mp4" | tee -a "$OUT/logs/summary.txt"
  rm -rf "$frames"
done
