#!/usr/bin/env bash
# 8 consecutive frames, every 3rd frame, from each preview, for the motion review.
# Windows sit on each clip's key motion (a hammer flip, a ball rolling out, the drop through the hole).
set -euo pipefail
cd "$(dirname "$0")/.."
declare -A START=([OverbalancedWheel]=${OB:-515} [WaterScrewMill]=${WM:-100} [SelfFlowingFlask]=${FL:-100} [MagnetRamp]=${MR:-240} [RollingBallWheel]=${RB:-470})
for n in "${!START[@]}"; do
  s=${START[$n]}
  d="renders/motion/$n"; rm -rf "$d"; mkdir -p "$d"
  ffmpeg -v error -i "renders/previews/PerpetualMotion_$n.mp4" -vf "select='between(n\,$s\,$((s+21)))*not(mod(n-$s\,3))'" -vsync 0 "$d/frame_%02d.png"
  echo "$n: frames $s..$((s+21)) step 3 → $(ls $d | wc -l) files"
done
