#!/bin/bash
# Renders the 3 LookDev stills, measures them against the reference frames and
# writes lookdev/compare-<moment>.png (reference | ours | difference).
# Usage: scripts/lookdev.sh <dir with reference frames named f<frame>.png>
set -e
REF="${1:?reference frame dir}"
cd "$(dirname "$0")/.."
rm -rf out/look && npx remotion render LookDev out/look --frames=0-2 --image-format=png --sequence --scale=0.5 --gl=angle --concurrency=1 --log=error
names=(start peak settled); frames=(45 112 337)
for i in 0 1 2; do
  python3 scripts/measure-look.py "$REF/f${frames[$i]}.png" out/look/element-$i.png --mask 285,170,480,260 \
    --json lookdev/measure-${names[$i]}.json --side-by-side lookdev/compare-${names[$i]}.png ${QUIET:+--quiet}
done
