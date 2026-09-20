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
# --color-space=bt709 matters just as much, and is less obvious. Remotion 4
# still defaults to BT.601 and writes no colour tag at all, so a player that
# assumes BT.709 for HD — which most do — decodes these colours visibly wrong:
# the V1 backdrop lands on #23aaef instead of #2fb5ee. Asking for bt709 both
# converts and tags, and Remotion recommends pairing it with png frames.
#
# --muted drops the silent audio track Remotion adds by default. It is not
# just dead weight: that track is 57ms longer than the video, which leaves the
# container duration past the last frame and puts a hitch in the loop.
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
    --color-space=bt709 \
    --muted \
    --crf="$CRF" \
    --gl="$GL" \
    --log=info
done
echo "Done. Output in ./out"
