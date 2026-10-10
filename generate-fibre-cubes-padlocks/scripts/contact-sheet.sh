#!/usr/bin/env bash
# Five evenly spaced 720p frames of a composition in one row.
# usage: contact-sheet.sh <id> <durationInFrames>
set -e
id=$1; n=$2; OUT=${OUT:-out/sheets}; mkdir -p "$OUT/tmp"
frames=""
for k in 0 1 2 3 4; do
  f=$(( k * (n - 1) / 4 ))
  npx remotion still "$id" "$OUT/tmp/${id}_$k.png" --frame=$f --scale=0.3333333333333333 --timeout=600000 --log=error
  frames="$frames $OUT/tmp/${id}_$k.png"
done
python3 - "$OUT/${id}_sheet.png" $frames <<'PY'
import sys
from PIL import Image
out, files = sys.argv[1], sys.argv[2:]
ims = [Image.open(f).resize((512, 288), Image.LANCZOS) for f in files]
sheet = Image.new("RGB", (512 * len(ims) + 8 * (len(ims) - 1), 288), (40, 40, 40))
for i, im in enumerate(ims): sheet.paste(im, (i * 520, 0))
sheet.save(out)
PY
echo "$OUT/${id}_sheet.png"
