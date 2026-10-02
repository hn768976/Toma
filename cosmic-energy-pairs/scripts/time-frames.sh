#!/usr/bin/env bash
# Usage: scripts/time-frames.sh <CompositionId> <startFrame> [scale]
# Renders 5 and then 35 frames (concurrency 1) and reports the marginal
# per-frame time, which excludes browser start-up and bundling.
set -euo pipefail
ID=$1; S=$2; SCALE=${3:-0.5}
OUT="renders/timing/$ID-$$"; mkdir -p "$OUT"
t() { local a b; a=$(date +%s.%N); npx remotion render "$ID" "$OUT/n$1" --sequence --frames=$S-$(( S + $1 - 1 )) --scale=$SCALE --concurrency=1 --log=error >/dev/null; b=$(date +%s.%N); echo "$b - $a" | bc; }
T5=$(t 5); T35=$(t 35)
echo "$ID scale=$SCALE frames $S..: per-frame $(echo "scale=3; ($T35 - $T5) / 30" | bc) s  (5 frames ${T5}s, 35 frames ${T35}s)"
rm -rf "$OUT"
