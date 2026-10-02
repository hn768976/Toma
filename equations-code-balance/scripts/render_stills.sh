#!/bin/bash
# Renders 3 PNG stills per composition at 6000x3375 (--scale=1.5625),
# at frames far apart, plus one 1920x1080 still of each (--scale=0.5).
# Usage: bash scripts/render_stills.sh [entry-or-bundle]
set -e
ENTRY=${1:-src/index.ts}
mkdir -p out/stills
declare -A FRAMES=(
  [EquationFlight-Black]="0 150 450"
  [EquationFlight-Navy]="0 150 450"
  [AICodeScreen-Dark]="0 200 400"
  [AICodeScreen-Light]="0 200 400"
  [BalanceScreen-Drain]="0 120 299"   # start value, mid-count, 0.00
  [BalanceScreen-Grow]="0 120 299"    # 0.00, mid-count, end value
)
for id in "${!FRAMES[@]}"; do
  name=${id/-/_}
  for f in ${FRAMES[$id]}; do
    npx remotion still "$ENTRY" "$id" "out/stills/${name}_f$(printf %03d $f)_6000x3375.png" --frame=$f --scale=1.5625
  done
  first=${FRAMES[$id]%% *}; [[ $id == EquationFlight* ]] && first=150
  [ "$id" = "BalanceScreen-Drain" ] && first=299
  npx remotion still "$ENTRY" "$id" "out/stills/${name}_1080p.png" --frame=$first --scale=0.5
done
