#!/bin/bash
# scripts/iter.sh <compId> <scale> <name> frame1 frame2 ...  -> out/iter/<name>.png
set -e
id=$1; sc=$2; name=$3; shift 3
npx remotion bundle src/index.ts --out-dir build >/dev/null 2>&1
d=out/iter/$name; rm -rf $d; mkdir -p $d
for f in "$@"; do node scripts/frames.mjs $id $sc $d $f $f 1 "${PROPS:-{\}}" 2>&1 | grep msPerFrame || { echo fail $f; exit 1; }; done
files=$(for f in "$@"; do ls $d/f*$(printf "%d" $f).png 2>/dev/null | head -1; done)
python3 scripts/sheet.py out/iter/$name.png ${COLS:-2} ${W:-640} $(ls $d/*.png | sort)
echo out/iter/$name.png
