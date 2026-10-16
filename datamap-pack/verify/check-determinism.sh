#!/bin/bash
# Step 3: middle frame (300) rendered alone from a cold start vs the same frame
# from the full (multi-threaded, concurrency 2) render. Byte for byte.
cd "$(dirname "$0")/.."
mkdir -p out/verify/cold
for c in ${@:-DataMap-Blue PlexusGlobe-Navy CircuitWarp-Violet SoftGradient-Lime SoftGradient-Peach WirePeaks-White WirePeaks-Cyan}; do
  f=${c/-/_}
  npx remotion still out/bundle "$c" "out/verify/cold/$f-300.png" --frame=300 --scale=0.3333333333333333 >/dev/null 2>&1
  if cmp -s "out/verify/cold/$f-300.png" "out/frames/$f/element-300.png"; then
    echo "PASS $c frame 300 PNG files identical (byte for byte)"
  else
    python3 verify/pixdiff.py "out/verify/cold/$f-300.png" "out/frames/$f/element-300.png" "$c cold vs full (files differ)"
  fi
done
