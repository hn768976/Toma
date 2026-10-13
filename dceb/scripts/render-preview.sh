#!/usr/bin/env bash
# Render one composition as a 720p PNG sequence, then encode the preview mp4.
#   scripts/render-preview.sh <CompositionId> <OutputName> [concurrency]
# Expects a bundle in ./build (npx remotion bundle src/index.ts --out-dir build).
set -euo pipefail
ID="$1"; NAME="$2"; CONC="${3:-2}"
cd "$(dirname "$0")/.."
mkdir -p out/frames out/previews out/stills out/logs
rm -rf "out/frames/$ID"
START=$(date +%s.%N)
npx remotion render "${BUILD:-build}" "$ID" "out/frames/$ID" --sequence --image-format=png \
  --scale=0.3333333333333333 --gl=angle --concurrency="$CONC" --timeout=600000 > "out/logs/$ID.render.log" 2>&1
END=$(date +%s.%N)
N=$(ls "out/frames/$ID" | grep -c '\.png$')
python3 -c "import sys; t=$END-$START; print(f'$ID frames={$N} total_s={t:.1f} s_per_frame={t/$N:.3f} concurrency=$CONC')" | tee -a out/logs/timings.txt
FIRST=$(ls "out/frames/$ID" | grep '\.png$' | sort | head -1)
PATTERN=$(echo "$FIRST" | sed -E 's/[0-9]+\.png$//')
DIGITS=$(echo "$FIRST" | sed -E 's/.*[^0-9]([0-9]+)\.png$/\1/' | tr -d '\n' | wc -c)
ffmpeg -v error -y -framerate 30 -start_number 0 -i "out/frames/$ID/${PATTERN}%0${DIGITS}d.png" \
  -c:v libx264 -preset slow -crf 16 -pix_fmt yuv420p -r 30 -an -movflags +faststart \
  "out/previews/$NAME.mp4"
echo "encoded out/previews/$NAME.mp4"
