#!/usr/bin/env bash
# Step 3: render frame 150 on its own from a cold start (a fresh `remotion
# still` process) and compare it with frame 150 from a multi-threaded,
# out-of-order sequence render. Usage: determinism.sh <Comp> <range> [bundle]
#   range: "0-299" for a full render, or e.g. "130-170" for the 3D looks.
set -uo pipefail
cd "$(dirname "$0")/.."
c=$1; range=$2; B=${3:-out/bundle-final}
[ -d "$B" ] || npx remotion bundle --out-dir="$B" --log=error >/dev/null 2>&1
d=out/verify/determinism/$c; rm -rf "$d"; mkdir -p "$d/seq"
npx remotion render "$B" "$c" "$d/seq" --sequence --image-format=png --frames=$range --scale=0.5 --concurrency=${CONC:-4} --log=error >/dev/null 2>&1 || echo "sequence render failed"
npx remotion still "$B" "$c" "$d/cold150.png" --frame=150 --scale=0.5 --log=error >/dev/null 2>&1 || echo "still failed"
seqf=$(ls "$d"/seq/*150.png | head -1)
echo "$c: cold still vs frame 150 of render $range ($(ls "$d"/seq | wc -l) frames)"
cmp -s "$d/cold150.png" "$seqf" && echo "  PNG files byte-identical" || echo "  PNG files differ at byte level (checking pixels)"
python3 verify/compare.py "$d/cold150.png" "$seqf"
