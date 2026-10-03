#!/usr/bin/env bash
# Frame 150 from a full multi-tab PNG sequence render vs. frame 150 rendered alone from a cold start.
set -uo pipefail
cd "$(dirname "$0")/.."
D=${OUT:-renders}/determinism; mkdir -p "$D"
COMPS=("$@"); [ ${#COMPS[@]} -eq 0 ] && COMPS=(Wormhole-Violet Wormhole-CyanGold CoinGrowth HologramThreatMap SparkleBurst-Blue SparkleBurst-Gold)
for c in "${COMPS[@]}"; do
  rm -rf "$D/seq"
  npx remotion render "$c" "$D/seq" --sequence --image-format=png --scale=0.3333333333333333 >/dev/null 2>&1
  cp "$D/seq/element-150.png" "$D/${c}_full150.png" 2>/dev/null || cp "$D/seq/"*150.png "$D/${c}_full150.png"
  rm -rf "$D/seq"
  npx remotion still "$c" "$D/${c}_cold150.png" --frame=150 --scale=0.3333333333333333 >/dev/null 2>&1
  if cmp -s "$D/${c}_full150.png" "$D/${c}_cold150.png"; then echo "$c frame 150: BYTE-IDENTICAL"; else echo "$c frame 150: DIFFERENT"; python3 scripts/imgdiff.py "$D/${c}_full150.png" "$D/${c}_cold150.png" "$c"; fi
done
