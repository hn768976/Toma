#!/usr/bin/env bash
# 6000x3375 PNG stills, two per composition (scale 6000/3840 = 1.5625).
set -euo pipefail
cd "$(dirname "$0")/.."
source tools/comps.sh
mkdir -p renders/stills-6k
for row in "${COMPS[@]}"; do
  IFS='|' read -r id name fa fb <<< "$row"
  if [ $# -gt 0 ] && [[ ! " $* " == *" $id "* ]]; then continue; fi
  for fr in "$fa" "$fb"; do
    npx remotion still "$id" "renders/stills-6k/${name}_f${fr}.png" --frame="$fr" --scale=1.5625 --log=error
  done
done
