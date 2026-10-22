#!/usr/bin/env bash
# Render the 720p previews (1280x720, H.264, yuv420p, CRF 16, 30 fps, no audio)
# and log wall-clock time per composition.
set -uo pipefail
cd "$(dirname "$0")/.."
OUT=${OUT:-out/previews}
mkdir -p "$OUT"
LOG="$OUT/render-times.tsv"
IDS=${*:-"FlightTrails-FlatNavy TangledThreads-White TangledThreads-Ink NeuronNetwork-Silver NeuronAnatomy-Labelled NeuronAnatomy-Clean DataServer-City DataServer-Dark ProximityApp-City ProximityApp-GreenScreen InkCloth-White"}
for id in $IDS; do
  name=${id/-/_}
  s=$(date +%s.%N)
  npx remotion render "$id" "$OUT/$name.mp4" \
    --scale=0.3333333333333333 --codec=h264 --crf=16 --pixel-format=yuv420p \
    --image-format=png --color-space=bt709 --muted --concurrency=2 --log=error
  rc=$?
  e=$(date +%s.%N)
  frames=$(ffprobe -v error -count_frames -select_streams v:0 -show_entries stream=nb_read_frames -of csv=p=0 "$OUT/$name.mp4" 2>/dev/null)
  printf "%s\t%s\t%.1f\t%s\n" "$name" "$rc" "$(echo "$e - $s" | bc)" "$frames" | tee -a "$LOG"
done
