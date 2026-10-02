#!/usr/bin/env bash
# Renders the 1080p previews the same way the checks need them:
#   1. full 600-frame PNG sequence, rendered by Remotion across several
#      threads (frames out of order) at --scale=0.5
#   2. H.264 / yuv420p / CRF 16 / 30 fps / no audio from those exact frames
#   3. frame 300 rendered again on its own from a cold start, compared byte-for-byte
# Usage: scripts/render-previews.sh [ClassicAtom EnergyAtom WispAtom]
set -euo pipefail
cd "$(dirname "$0")/.."
if [ $# -gt 0 ]; then COMPS=("$@"); else COMPS=(ClassicAtom EnergyAtom WispAtom); fi
mkdir -p out/previews out/frames out/checks
npx remotion bundle --out-dir=out/bundle --log=error >/dev/null
for C in "${COMPS[@]}"; do
  rm -rf "out/frames/$C"
  start=$(date +%s)
  npx remotion render out/bundle "$C" "out/frames/$C" --sequence --image-format=png \
    --scale=0.5 --concurrency=2 --log=error
  end=$(date +%s)
  echo "$C: 600 frames in $((end - start)) s = $(echo "scale=2; ($end - $start)/600" | bc) s/frame" | tee -a out/checks/timing.txt
  ffmpeg -v error -y -framerate 30 -i "out/frames/$C/element-%03d.png" \
    -vf "scale=out_color_matrix=bt709:out_range=tv,format=yuv420p" \
    -c:v libx264 -preset slow -tune grain -crf 16 -pix_fmt yuv420p \
    -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv \
    -movflags +faststart -an "out/previews/$C.mp4"
  npx remotion still out/bundle "$C" "out/checks/${C}_cold_300.png" --frame=300 --scale=0.5 --log=error >/dev/null
  node scripts/verify.mjs same "out/checks/${C}_cold_300.png" "out/frames/$C/element-300.png" | tee -a out/checks/determinism.txt
done
