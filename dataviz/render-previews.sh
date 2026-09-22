#!/usr/bin/env bash
# 1080p preview renders for all nine compositions.
set -u
cd "$(dirname "$0")"
declare -a IDS=(GrowthLine-Navy GrowthLine-Black BarChart-Cyan BarChart-Amber DarkDashboard-Teal DarkDashboard-Blue LightDashboard-Warm LightDashboard-Slate FinancialMontage-Blue)
declare -a OUT=(GrowthLine_Navy GrowthLine_Black BarChart_Cyan BarChart_Amber DarkDashboard_Teal DarkDashboard_Blue LightDashboard_Warm LightDashboard_Slate FinancialMontage_Blue)
for i in "${!IDS[@]}"; do
  id="${IDS[$i]}"; name="${OUT[$i]}"
  s=$(date +%s)
  npx remotion render "$id" "out/video/${name}.mp4" \
    --scale=0.5 --codec=h264 --crf=16 --pixel-format=yuv420p --image-format=png \
    > "out/video/${name}.log" 2>&1
  rc=$?
  e=$(date +%s)
  case "$id" in GrowthLine-*) frames=300;; *) frames=600;; esac
  echo "$name rc=$rc elapsed=$((e-s))s frames=$frames perframe=$(python3 -c "print(f'{($e-$s)/$frames:.4f}')")s"
done
