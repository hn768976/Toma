#!/usr/bin/env bash
# Renders the 720p previews (H.264, yuv420p, CRF 16, 30 fps) + a 720p still of
# each composition, and records wall-clock render time per frame.
# Usage: scripts/render-previews.sh [CBDC AI ...]   (default: all 10)
set -u
cd "$(dirname "$0")/.."
ids=${*:-"CBDC AI ESG IoT SaaS API ERP CRM KPI LLM"}
mkdir -p out/previews out/stills
[ -d out/bundle ] || npx remotion bundle src/index.ts --out-dir=out/bundle >/dev/null
for id in $ids; do
  s=$(date +%s.%N)
  npx remotion render out/bundle "AcronymCubes-$id" "out/previews/AcronymCubes_$id.mp4" \
    --scale=0.3333333333333333 --codec=h264 --crf=16 --pixel-format=yuv420p --muted --concurrency=1 \
    > "out/previews/AcronymCubes_$id.log" 2>&1 || echo "FAILED $id"
  e=$(date +%s.%N)
  echo "$id total_s=$(echo "$e - $s" | bc) per_frame_s=$(echo "scale=3; ($e - $s) / 600" | bc)" | tee -a out/previews/timings.txt
  npx remotion still out/bundle "AcronymCubes-$id" "out/stills/AcronymCubes_$id.png" --frame=150 \
    --scale=0.3333333333333333 >/dev/null 2>&1 || echo "STILL FAILED $id"
done
echo ALL_DONE
