#!/usr/bin/env bash
# Render the virus compositions to H.264 / MP4 at 30fps.
#
#   ./scripts/render.sh            # all 10 looks at 1080p  -> out/1080p/
#   ./scripts/render.sh 4k         # all 10 looks at 4K     -> out/4k/
#   ./scripts/render.sh 1080 v03   # a single look
#
# On a machine with a real GPU you can drop --gl/--browser-executable and let
# Remotion use its own Chrome; the shim exists only for software WebGL.
set -euo pipefail
cd "$(dirname "$0")/.."

RES="${1:-1080}"
ONLY="${2:-}"

case "$RES" in
  1080) SUFFIX="1080"; OUTDIR="out/1080p"; CRF=16 ;;
  4k)   SUFFIX="4k";   OUTDIR="out/4k";    CRF=18 ;;
  *) echo "usage: $0 [1080|4k] [lookId]" >&2; exit 2 ;;
esac

LOOKS=(v01 v02 v03 v04 v05 v06 v07 v08 v09 v10)
if [ -n "$ONLY" ]; then LOOKS=("$ONLY"); fi

mkdir -p "$OUTDIR"

BROWSER_ARGS=()
if [ -x "scripts/chrome-swiftshader.sh" ]; then
  BROWSER_ARGS=(--browser-executable="$PWD/scripts/chrome-swiftshader.sh")
fi

for id in "${LOOKS[@]}"; do
  echo "=== rendering ${id}-${SUFFIX}"
  npx remotion render "${id}-${SUFFIX}" "${OUTDIR}/${id}.mp4" \
    --codec=h264 \
    --crf="$CRF" \
    --gl=swangle \
    --concurrency="${REMOTION_CONCURRENCY:-4}" \
    "${BROWSER_ARGS[@]}" \
    --log=error
done

echo "done -> $OUTDIR"
ls -la "$OUTDIR"
