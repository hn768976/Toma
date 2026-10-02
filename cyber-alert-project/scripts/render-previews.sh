#!/usr/bin/env bash
# Renders the six 1080p previews (H.264, yuv420p, CRF 16, 30fps, no audio)
# from the composition defined at 3840x2160, using --scale=0.5.
set -euo pipefail
cd "$(dirname "$0")/.."
BUNDLE=${BUNDLE:-out/bundle}
mkdir -p renders
declare -A NAMES=(
  [ChipAlert-Red]=ChipAlert_Red [ChipAlert-Amber]=ChipAlert_Amber
  [GlitchWord-Warning]=GlitchWord_Warning [GlitchWord-AccessDenied]=GlitchWord_AccessDenied
  [BreachHUD-Blue]=BreachHUD_Blue [BreachHUD-Green]=BreachHUD_Green
)
COMPS=${*:-ChipAlert-Red ChipAlert-Amber GlitchWord-Warning GlitchWord-AccessDenied BreachHUD-Blue BreachHUD-Green}
for c in $COMPS; do
  s=$(date +%s%N)
  npx remotion render "$BUNDLE" "$c" "renders/${NAMES[$c]}.mp4" --scale=0.5 --codec=h264 \
    --pixel-format=yuv420p --crf=16 --muted --concurrency=4 > "renders/${NAMES[$c]}.log" 2>&1
  e=$(date +%s%N)
  echo "$c $(( (e-s)/1000000 )) ms total, $(( (e-s)/600000000 )) ms/frame"
done
