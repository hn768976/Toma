#!/usr/bin/env bash
# Per-frame render cost, one browser tab (--concurrency=1).
# Usage: scripts/time_looks.sh [scale=0.5] [frames=30]
# Renders 1 frame and 1+N frames per look; (T(1+N) - T(1)) / N removes bundling/browser start-up.
set -euo pipefail
cd "$(dirname "$0")/.."
SCALE=${1:-0.5}
N=${2:-30}
mkdir -p out/timing
for id in GrainGlow-Violet PlexusSphere-BlueViolet HexMosaic-Blue NeonBadge-MadeByHuman; do
  t() { local s e; s=$(date +%s.%N); npx remotion render "$id" "out/timing/$id-$1" --sequence --image-format=png \
        --frames="$2" --scale="$SCALE" --concurrency=1 --timeout=300000 --log=error >/dev/null; e=$(date +%s.%N); echo "$e - $s" | bc; }
  t1=$(t one 200-200)
  tn=$(t many "200-$((200 + N))")
  echo "$id @scale $SCALE  per-frame: $(echo "scale=3; ($tn - $t1) / $N" | bc) s   (1 frame ${t1}s, $((N + 1)) frames ${tn}s)"
done
rm -rf out/timing
