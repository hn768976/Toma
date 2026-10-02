#!/usr/bin/env bash
# Step 2: looping compositions get one extra frame via {"loopCheck": true}; frame 600 must equal frame 0.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p out/verify/loop
for id in GrainGlow-Violet GrainGlow-Sunset NeonBadge-MadeByHuman NeonBadge-MakePeace; do
  for f in 0 600; do
    npx remotion still "$id" "out/verify/loop/$id-$f.png" --frame=$f --scale=0.5 --props='{"loopCheck":true}' --log=error
  done
  echo "$id 0 vs 600: $(python3 scripts/compare_png.py "out/verify/loop/$id-0.png" "out/verify/loop/$id-600.png" || true)"
done
