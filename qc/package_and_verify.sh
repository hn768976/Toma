#!/bin/bash
# Packages each Remotion project into a ZIP (sources, assets, configs, lockfile;
# no node_modules / renders), then verifies every ZIP from a clean extraction:
#   unzip -> integrity test -> npm ci -> lint/typecheck -> list compositions
#   -> render a 4K still and a short 4K clip of every composition.
set -euo pipefail
ROOT=/home/user/Toma
OUT=$ROOT/deliverables
WORK=${1:-/tmp/zipverify}
mkdir -p "$OUT"
rm -rf "$WORK" && mkdir -p "$WORK"

declare -A ZIPS=(
  [revenue-growth-dashboard]="Project - Revenue Growth 3D Dashboard (4K Remotion).zip"
  [particle-world-map]="Project - Particle World Map Data Hologram (4K Remotion).zip"
)

for proj in revenue-growth-dashboard particle-world-map; do
  zipname="${ZIPS[$proj]}"
  echo "=== packaging $proj -> $zipname"
  rm -f "$OUT/$zipname"
  (cd "$ROOT/projects" && zip -q -r -X "$OUT/$zipname" "$proj" \
      -x "$proj/node_modules/*" "$proj/out/*" "$proj/dist/*" "$proj/.DS_Store")
  echo "--- integrity"
  unzip -tq "$OUT/$zipname"
  unzip -l "$OUT/$zipname" | tail -1
  sha256sum "$OUT/$zipname"

  echo "--- clean extraction + install"
  mkdir -p "$WORK/$proj-x"
  unzip -q "$OUT/$zipname" -d "$WORK/$proj-x"
  cd "$WORK/$proj-x/$proj"
  npm ci --loglevel=error --no-audit --no-fund
  npm run lint
  npx remotion compositions 2>&1 | grep -E -- "-4K "
  comps=$(npx remotion compositions -q 2>/dev/null | tail -1)
  [ -n "$comps" ] || { echo "no compositions found"; exit 1; }
  for comp in $comps; do
    echo "--- render check $comp (4K still + 4K frames 0-14)"
    npx remotion still "$comp" "out/$comp-check.png" --frame=150 --log=error
    npx remotion render "$comp" "out/$comp-check-4k.mp4" --frames=0-14 --log=error
    ffprobe -v error -select_streams v:0 \
      -show_entries stream=codec_name,width,height,r_frame_rate,nb_frames \
      -of compact "out/$comp-check-4k.mp4"
    python3 -c "from PIL import Image; im=Image.open('out/$comp-check.png'); print('still', im.size)"
  done
  cd "$ROOT"
done
echo "ALL ZIP CHECKS PASSED"
