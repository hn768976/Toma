#!/usr/bin/env bash
# Loop + determinism checks for every composition (1080p, PNG, lossless).
#  Loop:        render with --props '{"loopCheck":true}' (601 frames) and
#               compare frame 0 with frame 600 pixel for pixel.
#  Determinism: frames 300, 317, 333 as cold single stills vs the same
#               frames from a 4-thread sequence render (frames 260-340).
# Usage: bash tools/verify.sh [CompositionId ...]
set -uo pipefail
cd "$(dirname "$0")/.."
source tools/comps.sh
OUT=renders/verify
mkdir -p "$OUT"
pixmd5() { ffmpeg -v error -i "$1" -f rawvideo -pix_fmt rgba - | md5sum | cut -d' ' -f1; }
fail=0
for row in "${COMPS[@]}"; do
  IFS='|' read -r id name fa fb <<< "$row"
  if [ $# -gt 0 ] && [[ ! " $* " == *" $id "* ]]; then continue; fi
  d="$OUT/$name"; rm -rf "$d"; mkdir -p "$d"
  npx remotion still "$id" "$d/f0.png" --frame=0 --scale=0.5 --props='{"loopCheck":true}' --log=error
  npx remotion still "$id" "$d/f600.png" --frame=600 --scale=0.5 --props='{"loopCheck":true}' --log=error
  for fr in 300 317 333; do
    npx remotion still "$id" "$d/cold$fr.png" --frame=$fr --scale=0.5 --log=error
  done
  npx remotion render "$id" "$d/seq" --sequence --image-format=png --frames=260-340 --concurrency=4 --scale=0.5 --log=error
  a=$(pixmd5 "$d/f0.png"); b=$(pixmd5 "$d/f600.png")
  loop=$([ "$a" = "$b" ] && echo PASS || echo FAIL)
  det=PASS
  for fr in 300 317 333; do
    cmp -s "$d/cold$fr.png" "$(ls "$d"/seq/*$fr.png)" || det=FAIL
  done
  [ "$loop" = PASS ] && [ "$det" = PASS ] || fail=1
  echo "$id  loop(f0==f600)=$loop  determinism(cold f300/317/333 byte-identical to 4-thread render)=$det" | tee -a "$OUT/report.txt"
  rm -rf "$d/seq"
done
exit $fail
