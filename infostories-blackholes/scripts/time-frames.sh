#!/usr/bin/env bash
# Per-frame render time: (time for N+1 frames - time for 1 frame) / N, single thread,
# so browser start-up and bundling are excluded. Usage: scripts/time-frames.sh [scale] [N]
set -euo pipefail
SCALE=${1:-0.3333333333333333}
N=${2:-20}
OUT=${OUT:-out/checks/timing}
mkdir -p "$OUT"
npx remotion bundle --out-dir "$OUT/bundle" --log=error >/dev/null
t() { local s=$(date +%s.%N); "$@" >/dev/null 2>&1; echo "$(date +%s.%N) - $s" | bc; }
for id in ${IDS:-InfoStory-DataAnalysisIdea InfoStory-AIDAFunnel InfoStory-SWOT InfoPlane-Background BlackHole-EmberEclipse BlackHole-LensedPeach BlackHole-LensedIce}; do
  rm -rf "$OUT/$id"
  one=$(t npx remotion render "$OUT/bundle" "$id" "$OUT/$id/a" --sequence --frames=300-300 --concurrency=1 --scale=$SCALE --log=error)
  many=$(t npx remotion render "$OUT/bundle" "$id" "$OUT/$id/b" --sequence --frames=300-$((300+N)) --concurrency=1 --scale=$SCALE --log=error)
  per=$(echo "scale=3; ($many - $one) / $N" | bc)
  echo "$id  scale=$SCALE  ${per}s/frame"
done
