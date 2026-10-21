#!/bin/bash
# Renders the 8 x 720p previews (compositions are 4K; --scale=1/3) and logs timing.
set -e
cd "$(dirname "$0")"
OUT=${OUT:-out/previews}
mkdir -p "$OUT"
render() { # id file crf
  local t0=$(date +%s.%N)
  npx remotion render "$1" "$OUT/$2.mp4" --scale=0.3333333333333333 --crf="$3" --concurrency=3 --muted --log=error
  local t1=$(date +%s.%N)
  local n=$(ffprobe -v error -count_packets -select_streams v:0 -show_entries stream=nb_read_packets -of csv=p=0 "$OUT/$2.mp4")
  echo "$2 frames=$n wall=$(echo "$t1-$t0" | bc)s per_frame=$(echo "scale=3;($t1-$t0)/$n" | bc)s" | tee -a "$OUT/timings.txt"
}
: > "$OUT/timings.txt"
render HUDScope-Violet HUDScope_Violet 16
render VHSPlayback-OSD VHSPlayback_OSD 12
render VHSPlayback-Clean VHSPlayback_Clean 12
render TVStatic-Datamosh TVStatic_Datamosh 12
render TVStatic-Transition TVStatic_Transition 12
render ChalkMath-Flythrough ChalkMath_Flythrough 16
render ChalkMath-Write ChalkMath_Write 16
render NeuralGlobe-Labels NeuralGlobe_Labels 16
