#!/usr/bin/env bash
# Two 6000x3375 PNG stills per composition (3840x2160 x 1.5625).
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p out/stills6000
while read -r id frames; do
  for f in $frames; do
    npx remotion still "$id" "out/stills6000/${id/-/_}_f$f.png" --frame="$f" --scale=1.5625 --log=error
    echo "STILL ${id/-/_}_f$f.png"
  done
done <<'LIST'
GrainGlow-Violet 90 420
GrainGlow-Sunset 90 420
PlexusSphere-BlueViolet 150 440
PlexusSphere-TealWhite 150 440
HexMosaic-Blue 60 115
HexMosaic-Gold 60 115
NeonBadge-MadeByHuman 200 470
NeonBadge-MakePeace 200 470
LIST
