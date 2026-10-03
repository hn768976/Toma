#!/usr/bin/env bash
# Renders frame 200 of each composition on its own, in a fresh browser
# (cold start), and compares it with frame 200 of the full sequence render
# kept by render-previews.sh. Compares both the PNG file bytes and the
# decoded RGB pixels.
# Usage: scripts/determinism-check.sh [compId ...]
set -euo pipefail
OUT=${OUT:-renders}
ALL=(DataCenter-SideStreaks DataCenter-AisleFibres RisingArrows-Blue RisingArrows-Green PadlockGrid CloudHUD AICube-Blue AICube-Violet)
[ $# -gt 0 ] && COMPS=("$@") || COMPS=("${ALL[@]}")
mkdir -p "$OUT/determinism"
for comp in "${COMPS[@]}"; do
  name=${comp//-/_}
  full=$(ls "$OUT/frames/$name"/*200.png)
  cold="$OUT/determinism/${name}_f200_cold.png"
  npx remotion still "$comp" "$cold" --frame=200 --scale=0.3333333333333333 --log=error
  fa=$(md5sum < "$full" | cut -d' ' -f1); fb=$(md5sum < "$cold" | cut -d' ' -f1)
  pa=$(ffmpeg -v error -i "$full" -f rawvideo -pix_fmt rgb24 - | md5sum | cut -d' ' -f1)
  pb=$(ffmpeg -v error -i "$cold" -f rawvideo -pix_fmt rgb24 - | md5sum | cut -d' ' -f1)
  if [ "$fa" = "$fb" ] && [ "$pa" = "$pb" ]; then
    echo "PASS $comp frame 200: file $fa, pixels $pa"
  else
    echo "FAIL $comp frame 200: file $fa vs $fb, pixels $pa vs $pb"
  fi
done
