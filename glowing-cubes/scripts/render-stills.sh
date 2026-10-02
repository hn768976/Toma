#!/usr/bin/env bash
# Stills: two 6000×3375 PNGs per composition (`remotion still` at
# --scale=1.5625 of the 3840×2160 composition), plus one 1080p PNG each taken
# from the rendered preview frames.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p out/stills
declare -A FRAMES=(
  [CubeCluster-Green]="150 450" [CubeCluster-Violet]="150 450" [CubeCluster-Blue]="150 450"
  [CubeAssembly-Blue]="120 250" [CubeAssembly-Violet]="120 250" [CubeAssembly-Green]="120 250"
)
for id in CubeCluster-Green CubeCluster-Violet CubeCluster-Blue CubeAssembly-Blue CubeAssembly-Violet CubeAssembly-Green; do
  name="${id/-/_}"
  for f in ${FRAMES[$id]}; do
    s=$(date +%s)
    npx remotion still "$id" "out/stills/${name}_f${f}_6000x3375.png" --frame="$f" --scale=1.5625 > /dev/null 2>&1
    echo "$id frame $f 6000x3375: $(( $(date +%s) - s ))s (incl. browser start)" | tee -a out/logs/stills.txt
  done
  f1080=$([[ $id == CubeCluster-* ]] && echo 300 || echo 250)
  if [ -f "out/frames/$id/element-$(printf %03d "$f1080").png" ]; then
    cp "out/frames/$id/element-$(printf %03d "$f1080").png" "out/stills/${name}_f${f1080}_1080p.png"
  else
    npx remotion still "$id" "out/stills/${name}_f${f1080}_1080p.png" --frame="$f1080" --scale=0.5 > /dev/null 2>&1
  fi
done
