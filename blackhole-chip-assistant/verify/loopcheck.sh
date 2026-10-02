#!/usr/bin/env bash
# Step 2: loop check. Renders frames 0 and 600 of a 601-frame version of the
# composition (loopTest: phase NOT wrapped, so frame 600 only equals frame 0
# if every motion completes whole cycles) and compares them pixel for pixel.
# Also reports the seam: |599 -> 0| should be about the size of |598 -> 599|.
# Usage: verify/loopcheck.sh <CompositionId> <palette> [bundleDir]
set -uo pipefail
comp=$1; pal=$2; src=${3:-src/index.ts}
d=out/verify/loop/$comp; mkdir -p "$d"
props="{\"palette\":\"$pal\",\"loopTest\":true${4:+,\"hide\":$4}}"
for f in 0 600 598 599; do
  npx remotion still "$src" "$comp" "$d/f$f.png" --frame=$f --scale=0.5 --props="$props" --log=error >/dev/null 2>&1 || echo "render failed $f"
done
echo "frame 0 vs frame 600:"; python3 verify/compare.py "$d/f0.png" "$d/f600.png"; r=$?
echo "seam 599 -> 0:   "; python3 verify/compare.py "$d/f599.png" "$d/f0.png" || true
echo "normal 598 -> 599:"; python3 verify/compare.py "$d/f598.png" "$d/f599.png" || true
exit $r
