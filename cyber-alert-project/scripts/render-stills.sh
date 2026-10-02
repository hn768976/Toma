#!/usr/bin/env bash
# 6000x3375 PNG stills (3 per composition) + one 1080p PNG still each.
# Frames were chosen from the verify loop: word clean in look 2, several
# warnings fully visible (none mid-fade) in look 3.
set -euo pipefail
cd "$(dirname "$0")/.."
BUNDLE=${BUNDLE:-out/bundle}
mkdir -p renders/stills
declare -A FRAMES=(
  [ChipAlert-Red]="60 270 480" [ChipAlert-Amber]="60 270 480"
  [GlitchWord-Warning]="${GW_FRAMES:-5 240 500}" [GlitchWord-AccessDenied]="${GW_FRAMES:-5 240 500}"
  [BreachHUD-Blue]="${HUD_FRAMES:-100 300 520}" [BreachHUD-Green]="${HUD_FRAMES:-100 300 520}"
)
for c in "${!FRAMES[@]}"; do
  set -- ${FRAMES[$c]}
  for f in "$@"; do
    # 6000 / 3840 = 1.5625
    npx remotion still "$BUNDLE" "$c" "renders/stills/${c}_f${f}_6000.png" --frame="$f" --scale=1.5625 --image-format=png >/dev/null
  done
  npx remotion still "$BUNDLE" "$c" "renders/stills/${c}_1080.png" --frame="$2" --scale=0.5 --image-format=png >/dev/null
  echo "stills done: $c ($*)"
done
