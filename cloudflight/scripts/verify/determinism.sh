#!/bin/bash
# Step 3 + 6: render 2 s around the middle as a PNG sequence in one multi-tab
# session (frames out of order, warm tabs), then render the middle frame alone
# from a cold start, and compare.
set -e
mkdir -p out/verify/det
for spec in "CloudFlight-Day 225" "CloudFlight-Sunset 225" "CloudSea-Loop 300" "RainbowRings-Spectrum 300" \
            "SunLeaves-Summer 300" "SunLeaves-Autumn 300" "DataGrid-Teal 300" "RippleRings-Blue 300"; do
  set -- $spec; id=$1; mid=$2
  d=out/verify/det/$id; rm -rf $d; mkdir -p $d
  CONC=${CONC:-3} node scripts/frames.mjs $id 0.3333333333333333 $d/seq $((mid-30)) $((mid+29)) 1 >/dev/null 2>&1
  npx remotion still build $id $d/cold_$mid.png --frame=$mid --scale=0.3333333333333333 >/dev/null 2>&1
  python3 scripts/verify/compare.py $d/seq/f$((30)).png $d/cold_$mid.png "$id frame $mid sequence vs cold"
done
