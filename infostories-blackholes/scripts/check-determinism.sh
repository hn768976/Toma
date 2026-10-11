#!/usr/bin/env bash
# Frame 300 rendered alone from a cold start must equal frame 300 taken from a
# multi-threaded, out-of-order sequence render (frames 280-320, concurrency 4).
set -euo pipefail
OUT=${OUT:-out/checks/determinism}
SCALE=${SCALE:-0.3333333333333333}
mkdir -p "$OUT"
status=0
for id in InfoStory-DataAnalysisIdea InfoStory-AIDAFunnel InfoStory-SWOT InfoPlane-Background \
          BlackHole-EmberEclipse BlackHole-LensedPeach BlackHole-LensedIce; do
  npx remotion still "$id" "$OUT/${id}_cold300.png" --frame=300 --scale=$SCALE --log=error >/dev/null
  rm -rf "$OUT/${id}_seq"
  npx remotion render "$id" "$OUT/${id}_seq" --sequence --image-format=png --frames=280-320 \
    --concurrency=4 --scale=$SCALE --log=error >/dev/null
  seq300=$(ls "$OUT/${id}_seq" | grep -E '(^|[^0-9])0*300\.png$' | head -1)
  a=$(ffmpeg -v error -i "$OUT/${id}_cold300.png" -f framemd5 - | tail -1 | awk '{print $NF}')
  b=$(ffmpeg -v error -i "$OUT/${id}_seq/$seq300" -f framemd5 - | tail -1 | awk '{print $NF}')
  if [ "$a" = "$b" ]; then echo "PASS  $id  cold frame 300 == sequence frame 300  ($a)"; else echo "FAIL  $id  $a != $b"; status=1; fi
done
exit $status
