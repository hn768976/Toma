#!/usr/bin/env bash
# Per-frame render cost at 1080p (--scale=0.5), one browser tab (--concurrency=1).
# Renders 1 frame and 31 frames per look; (T31 - T1) / 30 removes bundling/browser start-up.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p out/timing
for id in GrainGlow-Violet PlexusSphere-BlueViolet HexMosaic-Blue NeonBadge-MadeByHuman; do
  t() { local s e; s=$(date +%s.%N); npx remotion render "$id" "out/timing/$id-$1" --sequence --image-format=png \
        --frames="$2" --scale=0.5 --concurrency=1 --log=error >/dev/null; e=$(date +%s.%N); echo "$e - $s" | bc; }
  t1=$(t one 200-200)
  t31=$(t many 200-230)
  echo "$id  per-frame: $(echo "scale=3; ($t31 - $t1) / 30" | bc) s   (1 frame run ${t1}s, 31 frame run ${t31}s)"
done
rm -rf out/timing
