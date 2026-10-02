#!/usr/bin/env bash
# Stills: 2 per composition at 6000x3375 (scale 1.5625 of 3840x2160), plus one 1080p still each.
set -euo pipefail
cd "$(dirname "$0")/.."
GL="${GL:-angle}"
mkdir -p out/stills/6000 out/stills/1080 out/timing
while read -r id a b one; do
  [ -z "$id" ] && continue
  for fr in $a $b; do
    s=$(date +%s.%N)
    npx remotion still "$id" "out/stills/6000/${id}_f${fr}.png" --frame=$fr --scale=1.5625 --gl="$GL" --log=error
    echo "$id f$fr 6000x3375 $(echo "$(date +%s.%N) - $s" | bc)s" | tee -a out/timing/stills6000.txt
  done
  npx remotion still "$id" "out/stills/1080/${id}.png" --frame=$one --scale=0.5 --gl="$GL" --log=error
done <<'LIST'
AIDiagnosis-Medical 200 435 300
AIDiagnosis-DNA 200 435 300
CartCounter-SlateUSD 40 299 299
CartCounter-LightEUR 40 299 299
DataStack-Cyan 150 359 359
DataStack-Amber 150 359 359
DotWorldMap-Lime 0 300 150
DotWorldMap-Cyan 0 300 150
GradientOrb-SunsetPink 0 300 150
GradientOrb-OceanMint 0 300 150
LIST
