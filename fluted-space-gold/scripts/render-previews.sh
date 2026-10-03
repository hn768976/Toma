#!/usr/bin/env bash
# Render the six 720p previews (H.264, yuv420p, 30 fps, CRF 16) and a PNG still of each.
set -euo pipefail
OUT=${OUT:-out/previews}
mkdir -p "$OUT"
declare -A NAMES=(
  [FlutedGlass-Sunset]=FlutedGlass_Sunset
  [FlutedGlass-CoolPastel]=FlutedGlass_CoolPastel
  [SunToAlphaCentauri-Clean]=SunToAlphaCentauri_Clean
  [SunToAlphaCentauri-Labelled]=SunToAlphaCentauri_Labelled
  [FrostedFoil-Gold]=FrostedFoil_Gold
  [FrostedFoil-Silver]=FrostedFoil_Silver
)
IDS=${IDS:-"FlutedGlass-Sunset FlutedGlass-CoolPastel SunToAlphaCentauri-Clean SunToAlphaCentauri-Labelled FrostedFoil-Gold FrostedFoil-Silver"}
for id in $IDS; do
  name=${NAMES[$id]}
  start=$(date +%s.%N)
  npx remotion render "$id" "$OUT/$name.mp4" --scale=0.3333333333333333 \
    --codec=h264 --crf=16 --pixel-format=yuv420p --image-format=png --gl=angle --muted --log=error
  end=$(date +%s.%N)
  echo "$id render seconds: $(echo "$end - $start" | bc)" | tee -a "$OUT/render-times.txt"
  still_frame=300; [[ $id == SunToAlphaCentauri* ]] && still_frame=540
  npx remotion still "$id" "$OUT/$name.png" --frame=$still_frame --scale=0.3333333333333333 --gl=angle --log=error
done
