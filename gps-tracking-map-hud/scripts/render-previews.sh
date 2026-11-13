#!/usr/bin/env bash
# Render 720p previews (scale 1/3 of the 4K compositions) as PNG sequences, then encode
# H.264 / yuv420p / CRF 16 / 30 fps. Loop looks render frames 0-600 (frame 600 is used by the
# loop check); the mp4 uses frames 0-599 = exactly 20.0 s.
# usage: scripts/render-previews.sh [GL] [CONCURRENCY] [ids...]
set -euo pipefail
cd "$(dirname "$0")/.."
GL=${1:-swangle}; CONC=${2:-2}; shift 2 || true
BROWSER_ARGS=()
[ -n "${HS:-}" ] && BROWSER_ARGS=(--browser-executable="$HS")
declare -A NAME=( [GPSTrack-Teal]=GPSTrack_Teal [GPSTrack-Interface]=GPSTrack_Interface [GPSAnalysis-Blue]=GPSAnalysis_Blue
  [GPSAnalysis-Amber]=GPSAnalysis_Amber [NightMap-HUD]=NightMap_HUD [MapFlyover-Blue]=MapFlyover_Blue [MapFlyover-Amber]=MapFlyover_Amber
  [TargetLocator-Grey]=TargetLocator_Grey [TargetLocator-Red]=TargetLocator_Red )
LOOPS=" GPSTrack-Teal GPSTrack-Interface NightMap-HUD TargetLocator-Grey TargetLocator-Red "
IDS=("$@"); [ ${#IDS[@]} -eq 0 ] && IDS=(GPSTrack-Teal GPSTrack-Interface GPSAnalysis-Blue GPSAnalysis-Amber NightMap-HUD MapFlyover-Blue MapFlyover-Amber TargetLocator-Grey TargetLocator-Red)
mkdir -p out/frames previews
for id in "${IDS[@]}"; do
  comp=$id; range=0-599
  if [[ "$LOOPS" == *" $id "* ]]; then comp="$id-check601"; range=0-600; fi
  dir=out/frames/$id; rm -rf "$dir"
  t0=$(date +%s.%N)
  npx remotion render "$comp" "$dir" --sequence --image-format=png --frames=$range \
    --scale=0.3333333333333333 --gl="$GL" --concurrency="$CONC" "${BROWSER_ARGS[@]}" --log=error
  t1=$(date +%s.%N)
  n=$(ls "$dir" | wc -l)
  first=$(ls "$dir" | head -1); pat=$(echo "$first" | sed -E 's/[0-9]+\.png$//'); digits=$(echo "$first" | sed -E 's/.*[^0-9]([0-9]+)\.png$/\1/' | wc -c); digits=$((digits-1))
  ffmpeg -v error -y -framerate 30 -start_number 0 -i "$dir/${pat}%0${digits}d.png" -frames:v 600 \
    -c:v libx264 -preset slow -crf 16 -pix_fmt yuv420p -an -movflags +faststart "previews/${NAME[$id]}.mp4"
  echo "$id frames=$n wall=$(echo "$t1 - $t0" | bc)s per_frame=$(echo "scale=3; ($t1 - $t0)/$n" | bc)s" | tee -a out/render-times.txt
done
