#!/usr/bin/env bash
# Step 2: render the looping composition at 601 frames and compare frame 600 to frame 0.
set -euo pipefail
cd "$(dirname "$0")/.."
id=$1; GL="${GL:-angle}"; d=out/verify/$id; mkdir -p $d
for fr in 0 600; do
  npx remotion still "$id" $d/loop_$fr.png --frame=$fr --scale=0.5 --gl="$GL" --props='{"loopCheck":true}' --log=error
done
if cmp -s $d/loop_0.png $d/loop_600.png; then echo "$id loop: frame 600 == frame 0 (byte-identical)"; else
  echo "$id loop: DIFFER"; python3 scripts/pxdiff.py $d/loop_0.png $d/loop_600.png; fi
