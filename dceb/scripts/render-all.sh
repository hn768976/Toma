#!/usr/bin/env bash
# Render all 10 previews (720p PNG sequence -> mp4). Usage: scripts/render-all.sh [ids...]
cd "$(dirname "$0")/.."
declare -A NAMES=(
  [DiamondRelief-WhiteRight]=DiamondRelief_WhiteRight [DiamondRelief-GraphiteLeft]=DiamondRelief_GraphiteLeft
  [CardRain-Black]=CardRain_Black [CardRain-GreenScreen]=CardRain_GreenScreen
  [NetworkEarth-BlueRight]=NetworkEarth_BlueRight [NetworkEarth-GoldLeft]=NetworkEarth_GoldLeft
  [WireframeBulb-Blue]=WireframeBulb_Blue [WireframeBulb-Emerald]=WireframeBulb_Emerald
  [CoinGrowth-BlueSilver]=CoinGrowth_BlueSilver [CoinGrowth-GoldGreen]=CoinGrowth_GoldGreen
)
IDS=("$@")
[ ${#IDS[@]} -eq 0 ] && IDS=(DiamondRelief-WhiteRight DiamondRelief-GraphiteLeft CardRain-Black CardRain-GreenScreen NetworkEarth-BlueRight NetworkEarth-GoldLeft WireframeBulb-Blue WireframeBulb-Emerald CoinGrowth-BlueSilver CoinGrowth-GoldGreen)
for id in "${IDS[@]}"; do
  scripts/render-preview.sh "$id" "${NAMES[$id]}" 3 || echo "FAILED $id"
done
echo ALLDONE
