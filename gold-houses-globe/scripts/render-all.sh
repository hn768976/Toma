#!/usr/bin/env bash
# All seven 720p previews. Pass composition ids to render a subset.
set -euo pipefail
cd "$(dirname "$0")/.."
declare -A NAME=( [LowPolyLuxe-Gold]=LowPolyLuxe_Gold [LowPolyLuxe-Silver]=LowPolyLuxe_Silver
  [CloudUpload]=CloudUpload [PriceHouses-Dollar]=PriceHouses_Dollar [PriceHouses-Euro]=PriceHouses_Euro
  [NetworkGrowth]=NetworkGrowth [ConnectedGlobe]=ConnectedGlobe )
declare -A STILL=( [LowPolyLuxe-Gold]=240 [LowPolyLuxe-Silver]=240 [CloudUpload]=240
  [PriceHouses-Dollar]=240 [PriceHouses-Euro]=240 [NetworkGrowth]=420 [ConnectedGlobe]=120 )
IDS=("$@"); [ ${#IDS[@]} -eq 0 ] && IDS=(LowPolyLuxe-Gold LowPolyLuxe-Silver CloudUpload PriceHouses-Dollar PriceHouses-Euro NetworkGrowth ConnectedGlobe)
for id in "${IDS[@]}"; do scripts/render-preview.sh "$id" "${NAME[$id]}" "${STILL[$id]}"; done
