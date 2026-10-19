#!/usr/bin/env bash
# Renders 1280x720 previews of the 10 overlay clips into out/previews/
# and logs seconds per clip to out/previews/times.tsv.
# Usage: scripts/render-previews.sh [CompName_With_Underscores ...]
set -euo pipefail
cd "$(dirname "$0")/.."
CLIPS=("$@")
[ ${#CLIPS[@]} -gt 0 ] || CLIPS=(DoodlePack_WhiteOnBlack DoodlePack_InkOnGreen ScribbleWipe_Marker ScribbleWipe_Ink \
  Handwritten_Hello Handwritten_ThankYou Handwritten_Welcome Handwritten_Subscribe NotebookPage_Loop InkFlourish_Black)
BUNDLE="${BUNDLE:-out/bundle}"
[ -d "$BUNDLE" ] || npx remotion bundle src/index.ts --out-dir="$BUNDLE"
mkdir -p out/previews
for name in "${CLIPS[@]}"; do
  id="${name//_/-}"   # composition ids use "-" (Remotion forbids "_")
  t0=$(date +%s.%N)
  npx remotion render "$BUNDLE" "$id" "out/previews/$name.mp4" \
    --codec=h264 --crf=16 --pixel-format=yuv420p --muted \
    --scale=0.3333333333333333 --log=error
  t1=$(date +%s.%N)
  frames=$(ffprobe -v error -select_streams v:0 -count_packets -show_entries stream=nb_read_packets -of csv=p=0 "out/previews/$name.mp4")
  printf "%s\t%d\t%.1f\t%.3f\n" "$name" "$frames" "$(echo "$t1-$t0" | bc)" "$(echo "($t1-$t0)/$frames" | bc -l)" | tee -a out/previews/times.tsv
done
