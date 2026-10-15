#!/usr/bin/env bash
# Renders all eight 720p previews (see render_preview.sh).
set -euo pipefail
cd "$(dirname "$0")/../.."
[ -d build ] || npx remotion bundle --out-dir build --log=error
while read -r id name frames; do
  if [ -f "renders/$name.mp4" ]; then echo "$name already rendered, skipping"; continue; fi
  bash scripts/verify/render_preview.sh "$id" "$name" "$frames" </dev/null
done <<'LIST'
DataPanels-Blue DataPanels_Blue 600
DataTower-Blue DataTower_Blue 600
ElementGrid-Grey ElementGrid_Grey 600
ElementGrid-IceBlue ElementGrid_IceBlue 600
TableAssemble-Light TableAssemble_Light 450
TableAssemble-Dark TableAssemble_Dark 450
TableFlyover-Blue TableFlyover_Blue 600
TableFlyover-DarkGold TableFlyover_DarkGold 600
LIST
