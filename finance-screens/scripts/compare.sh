#!/usr/bin/env bash
# compare.sh <stilldir> <frame> : ref|mine pairs for the 7 "as ref" versions -> out/pairs/A.png, B.png
cd "$(dirname "$0")/.."
D=$1; F=$2; R=${REFFRAMES:-out/refframes}
p() { scripts/pair.sh "$R/$1" "$D/$2_f$F.png" "out/pairs/$3.png"; }
mkdir -p out/pairs
p 1088489433_1.png FinanceMontage-Blue 1
p 4056761539_2.png CurvedChartWall-Blue 2
p 1106833545_1.png BarRace-Cyan 3
p 1106833523_1.png TickerLine-Blue 4
p 1106833543_1.png ColumnChart-Blue 5
p 3941450145_1.png TradingDashboard-Purple 6
p 3656499845_1.png NightChart-Gold 7
ffmpeg -v error -y -i out/pairs/1.png -i out/pairs/2.png -i out/pairs/3.png -i out/pairs/4.png -filter_complex vstack=inputs=4 out/pairs/A.png
ffmpeg -v error -y -i out/pairs/5.png -i out/pairs/6.png -i out/pairs/7.png -filter_complex vstack=inputs=3 out/pairs/B.png
