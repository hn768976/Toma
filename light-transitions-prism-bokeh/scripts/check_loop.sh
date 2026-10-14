#!/usr/bin/env bash
# Step 2 (loops): with the composition temporarily 601 frames long, frame 600 must equal frame 0.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p out/checks
npx remotion bundle src/index.ts --out-dir=out/bundle --log=error >/dev/null
for id in PrismLight-Rainbow RedBokeh-RedGold; do
  for f in 0 600; do
    npx remotion still out/bundle "$id" "out/checks/loop_${id}_$f.png" --frame=$f --props='{"durationOverride":601}' \
      --scale=0.3333333333333333 --gl=angle --log=error >/dev/null
  done
  python3 -I scripts/verify.py png-equal "out/checks/loop_${id}_0.png" "out/checks/loop_${id}_600.png" || true
done
