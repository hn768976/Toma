#!/usr/bin/env bash
# Per-frame render time, single tab: (time for N+1 frames − time for 1 frame) / N.
# Usage: scripts/timing.sh [720|4k] comp-id...
set -euo pipefail
cd "$(dirname "$0")/.."
mode=$1; shift
if [ "$mode" = 4k ]; then scale=1; n=2; else scale=0.3333333333333333; n=20; fi
tmp=$(mktemp -d)
t() { local s=$(date +%s.%N); "$@" >/dev/null 2>&1; echo "$(date +%s.%N) - $s" | bc; }
for id in "$@"; do
  t1=$(t npx remotion render build "$id" "$tmp/a" --sequence --image-format=png --frames=300-300 --scale=$scale --concurrency=1 --gl=angle)
  tn=$(t npx remotion render build "$id" "$tmp/b" --sequence --image-format=png --frames=300-$((300 + n)) --scale=$scale --concurrency=1 --gl=angle)
  printf "%-26s %s  %7.0f ms/frame  (1 frame run %.1fs, %d-frame run %.1fs)\n" "$id" "$mode" "$(echo "($tn - $t1) * 1000 / $n" | bc -l)" "$t1" $((n + 1)) "$tn"
  rm -rf "$tmp"/*
done
