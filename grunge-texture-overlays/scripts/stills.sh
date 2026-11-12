#!/usr/bin/env bash
# Usage: scripts/stills.sh <bundleDir> <outDir> <frame> [ids...]  — renders 720p PNG stills
set -euo pipefail
B=$1; O=$2; FR=$3; shift 3
IDS=${@:-"ScratchGrunge-Black ScratchGrunge-White PhotocopyGrunge-White PhotocopyGrunge-Black CharcoalGrunge-White CharcoalGrunge-Orange BrushFrame-White BrushFrame-Black"}
mkdir -p "$O"
for id in $IDS; do
  npx remotion still "$B" "$id" "$O/${id}_f${FR}.png" --frame="$FR" --scale=0.3333333333333333 --gl="${GL:-swangle}" --log=error >/dev/null 2>"$O/${id}.err" || { echo "FAIL $id"; grep -v "^at \|emory\|docker" "$O/${id}.err" | head -20; }
done
