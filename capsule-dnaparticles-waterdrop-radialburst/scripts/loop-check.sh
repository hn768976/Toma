#!/usr/bin/env bash
# Step 2: with REMOTION_LOOP_TEST_EXTRA=1 the loops are 601 frames long;
# render frames 0 and 600 at 720p and compare them pixel for pixel.
cd "$(dirname "$0")/.."
B=${BUNDLE:-build}
mkdir -p out/loopcheck
for c in DNAParticles-Violet DNAParticles-Teal WaterDrop-Blue RadialBurst-Navy RadialBurst-TealGold; do
  for f in 0 600; do
    REMOTION_LOOP_TEST_EXTRA=1 npx remotion still "$B" "$c" "out/loopcheck/${c}_$f.png" --frame=$f --scale=0.3333333333333333 --gl=angle >/dev/null 2>&1
  done
  echo "$c: $(python3 scripts/pixdiff.py out/loopcheck/${c}_0.png out/loopcheck/${c}_600.png)"
done
