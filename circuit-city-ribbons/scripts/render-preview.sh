#!/usr/bin/env bash
# Render a 1280x720 preview of one composition.
#
# Frames are rendered once by Remotion as a lossless PNG sequence (kept for the
# determinism / banding checks), then encoded to H.264 yuv420p CRF 16, 30 fps.
#
#   scripts/render-preview.sh <CompositionId> [concurrency]
set -euo pipefail
cd "$(dirname "$0")/.."
ID="$1"
CONC="${2:-4}"
NAME="${ID/-/_}"
mkdir -p out/frames/"$NAME" out/previews out/bundle
[ -f out/bundle/index.html ] || npx remotion bundle --out-dir=out/bundle
start=$(date +%s)
npx remotion render out/bundle "$ID" out/frames/"$NAME" \
  --sequence --image-format=png --scale=0.3333333333333333 \
  --concurrency="$CONC" --log=error
end=$(date +%s)
ffmpeg -v error -y -framerate 30 -start_number 0 -i out/frames/"$NAME"/element-%03d.png \
  -c:v libx264 -preset slow -crf 16 -pix_fmt yuv420p \
  -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv \
  -vf "scale=out_color_matrix=bt709:out_range=tv" -r 30 -an \
  -movflags +faststart out/previews/"$NAME".mp4
echo "$ID: $((end - start)) s render wall time, concurrency $CONC"
