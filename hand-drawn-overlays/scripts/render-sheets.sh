#!/usr/bin/env bash
# Renders the 12 clip-art sheets as transparent 1280x720 PNGs (review size)
# and tiles them, on a light checkerboard, into out/ClipArtSheet.png.
# Needs ImageMagick (montage/convert) for the tiling step.
set -euo pipefail
cd "$(dirname "$0")/.."
SHEETS="C1-Arrows-Black C2-Arrows-White C3-Circles-Frames C4-Underlines C5-Banners C6-Stars C7-Bubbles C8-Checks C9-Brackets C10-Hearts C11-Dividers C12-Emphasis"
BUNDLE="${BUNDLE:-out/bundle}"
[ -d "$BUNDLE" ] || npx remotion bundle src/index.ts --out-dir="$BUNDLE"
mkdir -p out/sheets
for s in $SHEETS; do echo "$s"; done | xargs -P 4 -I{} sh -c \
  "npx remotion still '$BUNDLE' 'ClipArt-{}' 'out/sheets/ClipArt-{}.png' --image-format=png --scale=0.3333333333333333 --log=error"

# Light checkerboard behind each transparent sheet, then a 3x4 grid.
convert -size 32x32 xc:'#FFFFFF' -fill '#E4E4E4' -draw 'rectangle 0,0 15,15' -draw 'rectangle 16,16 31,31' miff:- \
  | convert -size 1280x720 tile:- out/sheets/checker.png
# The white-ink sheet is reviewed on a dark checkerboard (white on light is invisible).
convert -size 32x32 xc:'#3A3A3A' -fill '#2A2A2A' -draw 'rectangle 0,0 15,15' -draw 'rectangle 16,16 31,31' miff:- \
  | convert -size 1280x720 tile:- out/sheets/checker-dark.png
tiles=()
for s in $SHEETS; do
  bg=out/sheets/checker.png
  case "$s" in *White*) bg=out/sheets/checker-dark.png ;; esac
  convert "$bg" "out/sheets/ClipArt-$s.png" -composite "out/sheets/review-$s.png"
  tiles+=("out/sheets/review-$s.png")
done
montage "${tiles[@]}" -tile 3x4 -geometry 1280x720+12+12 -background '#B8B8B8' out/ClipArtSheet.png
echo "out/ClipArtSheet.png"
