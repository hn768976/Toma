#!/usr/bin/env bash
# Step 8.7: measure the look on 5 frames of a final video against the same moments of
# its reference. usage: tools/look-over-time.sh <video.mp4> <ref-frames-dir> <frames> <outdir> [compare args...]
# <ref-frames-dir> holds the reference as %04d.png (1-based); <frames> is the frame count.
set -euo pipefail
VIDEO="$1"; REF="$2"; N="$3"; OUT="$4"; shift 4
mkdir -p "$OUT"
for k in 0 1 2 3 4; do
  f=$(( k * (N - 1) / 4 ))
  ffmpeg -v error -y -i "$VIDEO" -vf "select=eq(n\,$f)" -frames:v 1 "$OUT/frame-$f.png"
  printf '\n== frame %d\n' "$f"
  python3 "$(dirname "$0")/../hazard-barrels/scripts/compare-look.py" "$REF/$(printf '%04d' $((f + 1))).png" "$OUT/frame-$f.png" "$@" | grep -v Warning | grep -v nanmean
done
