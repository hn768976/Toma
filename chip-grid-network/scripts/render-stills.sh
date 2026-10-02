#!/usr/bin/env bash
# Renders the delivered stills:
#   6000 x 3375 PNG (--scale=1.5625), two per composition: mid-spread + end
#   1920 x 1080 PNG (--scale=0.5), one per composition (mid-spread)
set -euo pipefail
cd "$(dirname "$0")/.."
GL=${GL:-angle}
OUT=${OUT:-renders/stills}
mkdir -p "$OUT"
BUNDLE="$OUT/../bundle-stills"
rm -rf "$BUNDLE"; npx remotion bundle --out-dir="$BUNDLE" >/dev/null 2>&1
# composition  mid-spread-frame  end-frame
LIST=(
  "ChipGrid-ShieldSweepTop 110 440"
  "ChipGrid-AttackPullback 200 440"
  "ChipGrid-AttackSpread   180 440"
  "ChipGrid-ShieldRecovery 150 440"
)
for row in "${LIST[@]}"; do
  read -r COMP MID END <<< "$row"
  NAME=${COMP//-/_}
  for spec in "mid $MID" "end $END"; do
    read -r TAG F <<< "$spec"
    FILE="$OUT/${NAME}_${TAG}_f${F}_6000x3375.png"
    [ -f "$FILE" ] || npx remotion still "$BUNDLE" "$COMP" "$FILE" --frame="$F" --scale=1.5625 --gl="$GL" --timeout=900000 >/dev/null 2>&1
    echo "$FILE"
  done
  FILE="$OUT/${NAME}_f${MID}_1920x1080.png"
  npx remotion still "$BUNDLE" "$COMP" "$FILE" --frame="$MID" --scale=0.5 --gl="$GL" --timeout=300000 >/dev/null 2>&1
  echo "$FILE"
done
rm -rf "$BUNDLE"
