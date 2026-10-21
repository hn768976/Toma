#!/usr/bin/env bash
# Render the 720p previews (1280x720 H.264 yuv420p CRF 16, no audio) and log timings.
set -euo pipefail
OUT=${OUT:-out}
SRC=${SRC:-src/index.ts}
mkdir -p "$OUT/logs"
for P in White Black DarkSpin TrioGreen MixGreen; do
  s=$(date +%s.%N)
  npx remotion render "$SRC" "PhonePack-$P" "$OUT/PhonePack_$P.mp4" \
    --scale=0.3333333333333333 --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p \
    --image-format=png --color-space=bt709 --muted --x264-preset=veryslow --concurrency=4 > "$OUT/logs/$P.log" 2>&1
  e=$(echo "$(date +%s.%N) - $s" | bc)
  n=$(ffprobe -v error -count_frames -select_streams v:0 -show_entries stream=nb_read_frames -of csv=p=0 "$OUT/PhonePack_$P.mp4")
  echo "PhonePack_$P frames=$n seconds=$e per_frame=$(echo "scale=4; $e / $n" | bc)" | tee -a "$OUT/logs/timings.txt"
done
