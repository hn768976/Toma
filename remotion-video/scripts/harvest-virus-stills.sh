#!/bin/bash
# Stills harvest: three per look at 6000x3375, plus one 1080p PNG per look.
# --scale=1.5625 against the 3840-wide composition gives 6000 px.
cd /home/user/Toma/remotion-video
OUT=/home/user/Toma/remotion-video/out/stills
mkdir -p "$OUT"
: > /tmp/stills-progress.txt
# Frames come from each look's stillFrames row; mirrored here so the shell can drive it.
declare -A F=(
  [PaleMint]="80 260 470"
  [LimeSun]="110 300 500"
  [PastelMulti]="95 285 460"
  [DeepNavy]="70 250 480"
  [ElectricBlue]="100 290 470"
  [BloodField]="85 275 455"
  [BlackCyan]="90 280 465"
  [BokehDark]="105 295 475"
  [GlowBlue]="75 265 450"
  [AmberHorizon]="88 282 468"
)
for id in "${!F[@]}"; do
  set -- ${F[$id]}
  for fr in "$@"; do
    printf -v p "%04d" "$fr"
    npx remotion still "VirusField-$id" "$OUT/VirusField_${id}_f${p}_6000x3375.png" \
      --frame=$fr --scale=1.5625 --gl=angle --timeout=600000 >/dev/null 2>&1
    echo "$id f$fr rc=$? $(date +%T)" >> /tmp/stills-progress.txt
  done
  # One 1080p still per look, at its first chosen frame.
  set -- ${F[$id]}
  printf -v p "%04d" "$1"
  npx remotion still "VirusField-$id" "$OUT/VirusField_${id}_1080p.png" \
    --frame=$1 --scale=0.5 --gl=angle --timeout=600000 >/dev/null 2>&1
  echo "$id 1080p rc=$? $(date +%T)" >> /tmp/stills-progress.txt
done
echo "STILLS_DONE" >> /tmp/stills-progress.txt
