#!/usr/bin/env bash
# Renders 720p previews: Remotion renders a PNG sequence at --scale=1/3
# (3840x2160 -> 1280x720), ffmpeg encodes it (H.264, yuv420p, CRF 16, 30 fps,
# no audio). The PNG frames are kept for the determinism and banding checks.
# Usage: scripts/render-previews.sh [CompositionId ...]
set -euo pipefail
cd "$(dirname "$0")/.."
SCALE=0.3333333333333333
mkdir -p out/frames out/previews out/logs
[ -d out/bundle ] || npx remotion bundle --out-dir=out/bundle >/dev/null
ids=("$@")
if [ ${#ids[@]} -eq 0 ]; then
  mapfile -t ids < <(node -e "
    const s=require('fs').readFileSync('src/versions.ts','utf8');
    for (const m of s.matchAll(/id: \"([^\"]+)\"/g)) console.log(m[1]);")
fi
for id in "${ids[@]}"; do
  file=$(node -e "
    const s=require('fs').readFileSync('src/versions.ts','utf8');
    const m=[...s.matchAll(/id: \"([^\"]+)\",\s*file: \"([^\"]+)\"/g)].find(x=>x[1]==='$id'); console.log(m[2]);")
  rm -rf "out/frames/$file"
  start=$(date +%s.%N)
  npx remotion render out/bundle "$id" "out/frames/$file" --sequence --image-format=png \
    --scale=$SCALE --concurrency=${CONCURRENCY:-2} > "out/logs/$file.log" 2>&1
  end=$(date +%s.%N)
  n=$(ls "out/frames/$file" | wc -l)
  echo "$id frames=$n seconds=$(echo "$end - $start" | bc) per_frame=$(echo "scale=3; ($end - $start) / $n" | bc)" | tee -a out/logs/timings.txt
  first=$(ls "out/frames/$file" | head -1)
  pattern=$(echo "$first" | sed -E 's/[0-9]+\.png$//')
  digits=$(echo "$first" | sed -E 's/^.*[^0-9]([0-9]+)\.png$/\1/' | tr -d '\n' | wc -c)
  ffmpeg -v error -y -framerate 30 -i "out/frames/$file/${pattern}%0${digits}d.png" \
    -c:v libx264 -preset slow -crf 16 -pix_fmt yuv420p -r 30 -an -movflags +faststart \
    "out/previews/$file.mp4"
  mid=$(( n / 2 ))
  cp "out/frames/$file/$(ls "out/frames/$file" | sed -n "$((mid + 1))p")" "out/previews/$file.png"
done
