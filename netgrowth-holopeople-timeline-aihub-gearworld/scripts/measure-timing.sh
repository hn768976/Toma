#!/usr/bin/env bash
# Per-frame render time at 720p, single thread: (time for 80 frames - time for 20 frames) / 60.
# This cancels the fixed browser/bundle start-up cost.
set -uo pipefail
cd "$(dirname "$0")/.."
. scripts/comps.sh
SCALE=${SCALE:-0.3333333333333333}
mkdir -p out/timing
t() { local s e; s=$(date +%s.%N); npx remotion render out/bundle "$1" out/timing/t.mp4 --frames="$2" --concurrency=1 --scale="$SCALE" --gl=angle >/dev/null 2>&1; e=$(date +%s.%N); echo "$e - $s" | bc; }
for row in $COMPS; do
  IFS=: read -r id file frames kind <<<"$row"
  mid=$((frames / 2))
  a=$(t "$id" "$((mid - 40))-$((mid - 21))")
  b=$(t "$id" "$((mid - 40))-$((mid + 39))")
  echo "$id $(echo "scale=3; ($b - $a) / 60" | bc) s/frame"
done
