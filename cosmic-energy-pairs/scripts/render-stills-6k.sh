#!/usr/bin/env bash
# Two 6000×3375 PNG stills per composition (3840×2160 × 1.5625).
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p out/stills-6k
while read -r ID F1 F2; do
  for F in $F1 $F2; do
    NAME=${ID/-/_}
    npx remotion still "$ID" "out/stills-6k/${NAME}_f$(printf %03d "$F").png" --frame="$F" --scale=1.5625 --image-format=png --log=error < /dev/null
    echo "still $ID frame $F"
  done
done <<'LIST'
GalaxySpiral-Blue 60 360
GalaxySpiral-Gold 60 360
EnergyOrb-Blue 90 390
EnergyOrb-Magenta 90 390
ParticleWorldMap-Blue 245 420
ParticleWorldMap-Gold 245 420
CellDivision-Cyan 120 330
CellDivision-Emerald 120 330
NebulaCore-Violet 100 400
NebulaCore-Teal 100 400
LIST
