#!/usr/bin/env bash
# Step 3: renders frame 300 of each composition on its own from a cold start
# and compares it byte for byte with frame 300 kept from the full render
# (scripts/render-previews.sh).
set -u
OUT=${1:-out}
declare -A ID=(
  [AndroidTraderHUD_Left]=AndroidTraderHUD-Left
  [AndroidTraderHUD_Right]=AndroidTraderHUD-Right
  [GrowthChartHUD_Story]=GrowthChartHUD-Story
  [ServerRack_FrontScroll]=ServerRack-FrontScroll
  [ServerRack_DiagonalGlide]=ServerRack-DiagonalGlide
  [ServerRack_LowAngle]=ServerRack-LowAngle
)
for n in "${!ID[@]}"; do
  full="$OUT/frames/$n-300-full.png"
  [ -f "$full" ] || { echo "$n: no full-render frame"; continue; }
  cold="$OUT/frames/$n-300-cold.png"
  npx remotion still "${ID[$n]}" --frame=300 --scale=0.3333333333333333 "$cold" > /dev/null 2>&1
  if cmp -s "$full" "$cold"; then echo "$n: frame 300 BYTE-IDENTICAL"; else echo "$n: frame 300 DIFFERS"; fi
done
