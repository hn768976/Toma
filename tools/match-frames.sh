#!/usr/bin/env bash
# Step 8.10: extract start/middle/end frames of a video and of its reference into one folder.
# usage: tools/match-frames.sh <video.mp4> <ref-frames-dir> <frames> <outdir>
set -euo pipefail
V="$1"; REF="$2"; N="$3"; OUT="$4"; mkdir -p "$OUT/first-set" "$OUT/second-set"
i=1
for f in 0 $(( (N - 1) / 2 )) $(( N - 1 )); do
  name=$( [ $i = 1 ] && echo start || { [ $i = 2 ] && echo middle || echo end; } )
  cp "$REF/$(printf '%04d' $((f + 1))).png" "$OUT/first-set/$name.png"
  ffmpeg -v error -y -i "$V" -vf "select=eq(n\,$f),scale=898:506:flags=area" -frames:v 1 "$OUT/second-set/$name.png"
  i=$((i + 1))
done
ls "$OUT"/*
