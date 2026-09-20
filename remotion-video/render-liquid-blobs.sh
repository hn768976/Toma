#!/usr/bin/env bash
# Renders every Liquid Blobs variant at the given resolution tier.
#
#   ./render-liquid-blobs.sh            # all four variants at 1080p
#   ./render-liquid-blobs.sh 4K         # all four at 3840x2160
#   ./render-liquid-blobs.sh 1080p V3-Red
#
# --image-format=png matters here: the frames are large areas of very shallow
# gradient, and the default JPEG intermediate leaves visible blocking in them
# before h264 ever sees the picture.
#
# --gl=swangle selects SwiftShader, needed only on machines with no GPU. On a
# real GPU drop it (or use --gl=angle) and the render is far faster; the
# composition itself prefers WebGPU and falls back on its own.
set -euo pipefail

TIER="${1:-1080p}"
ONLY="${2:-}"
VARIANTS=(V1-Blue V2-White V3-Red V4-Beige)
GL="${REMOTION_GL:-swangle}"
CRF="${CRF:-16}"

mkdir -p out
for v in "${VARIANTS[@]}"; do
  if [ -n "$ONLY" ] && [ "$v" != "$ONLY" ]; then continue; fi
  id="LiquidBlobs-${v}-${TIER}"
  out="out/${id}.mp4"
  echo "==> ${id}"
  npx remotion render "$id" "$out" \
    --codec=h264 \
    --image-format=png \
    --crf="$CRF" \
    --gl="$GL" \
    --log=info
done
echo "Done. Output in ./out"
