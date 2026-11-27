#!/bin/sh
# Render the three look-dev stills at delivery scale and compare with the
# reference frames (REF = folder holding f0.png, f563.png, f844.png).
REF=${REF:-../refs-frames-A}
set -e
for pair in start:0 middle:563 peak:844; do
  m=${pair%%:*}; f=${pair##*:}
  npx remotion still LookDev out/ld-$m.png --scale=${SCALE:-0.5} --gl=angle --props="{\"moment\":\"$m\",\"palette\":\"teal\"}" --log=error >/dev/null
  printf "%s: " $m
  python3 scripts/measure-look.py $REF/f$f.png out/ld-$m.png --mask 285,170,480,260 --json lookdev/measure-$m.json --side-by-side lookdev/compare-$m.png | grep -E "FAIL|^--" | awk '{printf "%s %s %s %s | ", $1,$2,$3,$5} END{print ""}'
done
