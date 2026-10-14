#!/bin/bash
# Step 2: with --props loopCheck (601 frames) render frames 0 and 600 as PNG
#         and compare pixel for pixel.
# Step 3: render frame 300 on its own from a cold start (fresh browser) and
#         compare byte for byte with frame 300 of the full sequence render.
# usage: BUNDLE=out/bundleX scripts/loop_and_determinism.sh CompId FileBase
cd "$(dirname "$0")/.."
B=${BUNDLE:-out/bundle}; c=$1; f=$2; d=out/checks/ld_$f; mkdir -p $d
S=0.3333333333333333
npx remotion still $B $c $d/loop_f0.png   --frame=0   --scale=$S --props='{"loopCheck":true}' >/dev/null 2>&1
npx remotion still $B $c $d/loop_f600.png --frame=600 --scale=$S --props='{"loopCheck":true}' >/dev/null 2>&1
echo "$c LOOP 0 vs 600: $(python3 scripts/compare_png.py $d/loop_f0.png $d/loop_f600.png)"
npx remotion still $B $c $d/cold_f300.png --frame=300 --scale=$S --image-format=png >/dev/null 2>&1
echo "$c DETERMINISM cold f300 vs full-render f300: $(python3 scripts/compare_png.py $d/cold_f300.png out/frames/$f/element-300.png)"
