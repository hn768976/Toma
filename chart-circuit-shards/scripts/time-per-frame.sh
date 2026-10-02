#!/usr/bin/env bash
# Measures steady-state render time per frame at 720p (concurrency 1) for a
# composition: T(40 frames) - T(10 frames), divided by 30 (removes startup).
# usage: scripts/time-per-frame.sh <bundleDir|src/index.ts> <compId> [startFrame]
set -euo pipefail
B=$1; C=$2; F0=${3:-100}
OUT="$PWD/out/timing_${C}"
rm -rf "$OUT"; mkdir -p "$OUT"  # no dots in this path: Remotion rejects sequence dirs with an extension
run() {
  local n=$1
  local t0=$(date +%s.%N)
  npx remotion render "$B" "$C" --sequence --image-format=png --scale=0.3333333333333333 \
    --frames=$F0-$((F0 + n - 1)) --concurrency=1 --output="$OUT/n$n" --log=error >&2
  [ "$(ls "$OUT/n$n" | wc -l)" -eq "$n" ] || { echo "render failed" >&2; exit 1; }
  local t1=$(date +%s.%N)
  echo "$t1 - $t0" | bc
}
T10=$(run 10)
T40=$(run 40)
PER=$(echo "scale=3; ($T40 - $T10) / 30" | bc)
echo "$C per_frame_s=$PER (T10=$T10 T40=$T40)"
rm -rf "$OUT"
