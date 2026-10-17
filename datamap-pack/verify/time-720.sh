#!/bin/bash
# Per-frame render time at 720p: (T(60 frames) - T(1 frame)) / 59, concurrency 1, idle machine.
cd "$(dirname "$0")/.."
mkdir -p out/verify/t720
for c in ${@:-DataMap-Blue PlexusGlobe-Navy CircuitWarp-Violet SoftGradient-Lime SoftGradient-Peach WirePeaks-White WirePeaks-Cyan}; do
  s=$(date +%s.%N); npx remotion render out/bundle "$c" out/verify/t720/a --sequence --image-format=png --frames=300-300 --scale=0.3333333333333333 --concurrency=1 >/dev/null 2>&1; e=$(date +%s.%N); t1=$(echo "$e-$s"|bc)
  s=$(date +%s.%N); npx remotion render out/bundle "$c" out/verify/t720/b --sequence --image-format=png --frames=270-329 --scale=0.3333333333333333 --concurrency=1 >/dev/null 2>&1; e=$(date +%s.%N); t60=$(echo "$e-$s"|bc)
  echo "$c t1=${t1}s t60=${t60}s per_frame=$(echo "scale=3; ($t60-$t1)/59" | bc)s"
done
