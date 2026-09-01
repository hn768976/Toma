#!/usr/bin/env bash
# Builds the two distributable zips. Each contains the complete project — the
# two boards share every line of code — with a README written for its board.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
stage="$root/.package"
rm -rf "$stage"
mkdir -p "$stage"

blue_desc='**v1 "blue"** — a chart sitting on a data backdrop. The number grid is
the backdrop and the chart layer draws opaquely on top of it. The plane recedes
to the upper right (rotated -12°, sheared so the right compresses ~9%). Chart
mix: candlesticks, volume bars and three moving-average lines. Grid density:
roughly 14 columns × 20 rows, 12% of positions left empty.'

amber_desc='**v2 "amber"** — a data board with charts bleeding through it. The
chart layer draws *behind* the number grid, and the grid is laid over it at 85%
opacity so the candles show faintly between the cells. The plane is mirrored to
recede to the upper left (rotated +10° with the shear reversed). Chart mix:
candlesticks and volume bars only — behind a dense grid, three coloured curves
would read as noise. Grid density: roughly 18 columns × 26 rows in smaller
type, with 18% of positions left empty so the denser field still breathes.'

build() {
  local key="$1" comp="$2" other="$3" title="$4" outname="$5" desc="$6"
  local dir="$stage/data-wall-$key"
  mkdir -p "$dir"
  cp -R "$root/src" "$dir/src"
  cp -R "$root/public" "$dir/public"
  cp "$root/package.json" "$root/package-lock.json" "$root/tsconfig.json" \
     "$root/remotion.config.ts" "$root/.gitignore" "$dir/"

  python3 - "$root/tools/readme-template.md" "$dir/README.md" \
    "$comp" "$other" "$title" "$outname" "$desc" <<'PY'
import sys
tpl, dest, comp, other, title, outname, desc = sys.argv[1:8]
text = open(tpl).read()
for token, value in (
    ("{{COMPOSITION}}", comp),
    ("{{OTHER_COMPOSITION}}", other),
    ("{{TITLE}}", title),
    ("{{OUTNAME}}", outname),
    ("{{DESCRIPTION}}", desc),
):
    text = text.replace(token, value)
open(dest, "w").write(text)
PY

  (cd "$dir" && zip -q -r "$root/data-wall-$key.zip" . \
      -x '*/node_modules/*' '*/out/*' '*/.git/*')
  echo "built data-wall-$key.zip"
}

build blue  DataWallBlue  DataWallAmber "v1, blue"  datawall-blue  "$blue_desc"
build amber DataWallAmber DataWallBlue  "v2, amber" datawall-amber "$amber_desc"

rm -rf "$stage"
