#!/bin/bash
# Step 2: with loopCheck (601 frames), frame 600 must equal frame 0 pixel for pixel.
cd "$(dirname "$0")/.."
mkdir -p out/verify/loop
for c in ${@:-DataMap-Blue PlexusGlobe-Navy CircuitWarp-Violet SoftGradient-Lime SoftGradient-Peach WirePeaks-White WirePeaks-Cyan}; do
  for fr in 0 600; do
    npx remotion still out/bundle "$c" "out/verify/loop/$c-$fr.png" --frame=$fr \
      --props='{"loopCheck":true}' --scale=0.3333333333333333 >/dev/null 2>&1
  done
  python3 verify/pixdiff.py "out/verify/loop/$c-0.png" "out/verify/loop/$c-600.png" "$c loop 0 vs 600"
done
