#!/bin/sh
# Render stills of V1 at the start / middle / end frames and compare with the
# reference frames (REF = folder holding f0.png, f563.png, f1125.png).
REF=${REF:-../refs-frames-A}
OUT=${OUT:-out/match}
mkdir -p $OUT
for f in 0 563 1125; do
  npx remotion still ${COMP:-V1-teal-waves} $OUT/f$f.png --frame=$f --scale=${SCALE:-0.5} --gl=angle --log=error >/dev/null
  printf "f%s: " $f
  python3 scripts/measure-look.py $REF/f$f.png $OUT/f$f.png --mask 285,170,480,260 --json $OUT/f$f.json | grep -E "FAIL|^--" | awk '{printf "%s %s %s | ", $1,$2,$3} END{print ""}'
done
