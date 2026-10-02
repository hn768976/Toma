#!/usr/bin/env bash
# Step 4: render the whole composition as a PNG sequence (two tabs, frames out of order),
# then render the self-check frame on its own in a fresh process and compare byte for byte.
set -euo pipefail
cd "$(dirname "$0")/.."
IDS=("$@")
[ ${#IDS[@]} -eq 0 ] && IDS=(GrainGlow-Violet GrainGlow-Sunset PlexusSphere-BlueViolet PlexusSphere-TealWhite
  HexMosaic-Blue HexMosaic-Gold NeonBadge-MadeByHuman NeonBadge-MakePeace)
mkdir -p out/verify/determinism
for id in "${IDS[@]}"; do
  case "$id" in Hex*) n=120;; *) n=300;; esac
  seq="out/verify/seq-$id"
  rm -rf "$seq"
  npx remotion render "$id" "$seq" --sequence --image-format=png --scale=0.5 --concurrency=2 --log=error
  full=$(ls "$seq" | sort | sed -n "$((n + 1))p")
  cp "$seq/$full" "out/verify/determinism/$id-full-$n.png"
  rm -rf "$seq"
  npx remotion still "$id" "out/verify/determinism/$id-cold-$n.png" --frame=$n --scale=0.5 --log=error
  echo "$id frame $n: $(python3 scripts/compare_png.py "out/verify/determinism/$id-full-$n.png" "out/verify/determinism/$id-cold-$n.png" || true)"
done
