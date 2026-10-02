#!/usr/bin/env bash
# 1080p previews (H.264, yuv420p, CRF 16, 30fps -- codec settings come from remotion.config.ts)
# plus one 1080p PNG still per composition. Usage: scripts/render_previews.sh [compId ...]
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p out/previews out/stills1080
IDS=("$@")
[ ${#IDS[@]} -eq 0 ] && IDS=(GrainGlow-Violet GrainGlow-Sunset PlexusSphere-BlueViolet PlexusSphere-TealWhite
  HexMosaic-Blue HexMosaic-Gold NeonBadge-MadeByHuman NeonBadge-MakePeace)
still_frame() { case "$1" in GrainGlow*) echo 300;; Plexus*) echo 440;; Hex*) echo 115;; Neon*) echo 200;; esac; }
for id in "${IDS[@]}"; do
  name=${id/-/_}
  s=$(date +%s)
  npx remotion render "$id" "out/previews/$name.mp4" --scale=0.5 --concurrency=2 --log=error
  e=$(date +%s)
  echo "RENDERED $name.mp4 in $((e - s))s"
  npx remotion still "$id" "out/stills1080/$name.png" --frame="$(still_frame "$id")" --scale=0.5 --log=error
done
