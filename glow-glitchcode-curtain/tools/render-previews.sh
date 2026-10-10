#!/bin/bash
# Renders the five 1280x720 previews (+ 720p PNG stills) from out/bundle.
# usage: tools/render-previews.sh [CompositionId ...]   (default: all five)
cd "$(dirname "$0")/.."
SCALE=0.3333333333333333
mkdir -p out/previews out/stills
declare -A NAMES=(
  [GlowGradient-Aurora]=GlowGradient_Aurora [GlowGradient-Sunset]=GlowGradient_Sunset
  [GlitchCode-MonoRGB]=GlitchCode_MonoRGB
  [LightCurtain-MagentaFire]=LightCurtain_MagentaFire [LightCurtain-BlueTeal]=LightCurtain_BlueTeal
)
IDS=("$@"); [ ${#IDS[@]} -eq 0 ] && IDS=(GlowGradient-Aurora GlowGradient-Sunset GlitchCode-MonoRGB LightCurtain-MagentaFire LightCurtain-BlueTeal)
for ID in "${IDS[@]}"; do
  N=${NAMES[$ID]}; T0=$(date +%s)
  npx remotion render out/bundle "$ID" "out/previews/$N.mp4" --scale=$SCALE --codec=h264 --crf=16 --pixel-format=yuv420p --muted --concurrency=4 2>&1 | grep -iE "rror"
  echo "$ID: render wall $(( $(date +%s) - T0 )) s (4 tabs)"
  npx remotion still out/bundle "$ID" "out/stills/$N.png" --frame=${STILL_FRAME:-300} --scale=$SCALE 2>&1 | grep -iE "rror"
done
