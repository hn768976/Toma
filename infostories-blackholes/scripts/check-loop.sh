#!/usr/bin/env bash
# Seam check for the 20 s loops. With --props loopCheck=true each loop composition
# becomes 601 frames and the animation phase is NOT wrapped, so frame 600 evaluates
# every periodic function at t = 1.0. Frames 0 and 600 must be pixel-identical.
set -euo pipefail
OUT=${OUT:-out/checks/loop}
SCALE=${SCALE:-0.3333333333333333}
mkdir -p "$OUT"
status=0
for id in InfoPlane-Background BlackHole-EmberEclipse BlackHole-LensedPeach BlackHole-LensedIce; do
  for f in 0 600; do
    npx remotion still "$id" "$OUT/${id}_$f.png" --frame=$f --scale=$SCALE \
      --props='{"loopCheck":true}' --log=error >/dev/null
  done
  a=$(ffmpeg -v error -i "$OUT/${id}_0.png" -f framemd5 - | tail -1 | awk '{print $NF}')
  b=$(ffmpeg -v error -i "$OUT/${id}_600.png" -f framemd5 - | tail -1 | awk '{print $NF}')
  if [ "$a" = "$b" ]; then echo "PASS  $id  frame 0 == frame 600  ($a)"; else echo "FAIL  $id  $a != $b"; status=1; fi
done
exit $status
