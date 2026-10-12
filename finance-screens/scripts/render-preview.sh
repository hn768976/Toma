#!/usr/bin/env bash
# Renders one composition's 720p preview + the loop/determinism checks.
#   scripts/render-preview.sh <compositionId> <fileName>
# 1. One full render of 601 frames (loopCheck props) to PNGs at --scale=1/3
#    -> frames 0..599 are encoded to renders/<fileName>.mp4 (H.264, yuv420p,
#    30 fps, CRF 16, no audio); frame 600 is used for the loop check.
# 2. Frame 300 rendered on its own from a cold start (new browser) for the
#    determinism check.
# 3. A 720p PNG still (frame 150).
set -euo pipefail
cd "$(dirname "$0")/.."
ID=$1; FILE=$2
SCALE=0.3333333333333333
FR=out/frames/$ID
mkdir -p renders out/frames out/cold stills logs
rm -rf "$FR"
PROPS="{\"versionId\":\"$ID\",\"loopCheck\":true}"
T0=$(date +%s.%N)
npx remotion render build "$ID" "$FR" --sequence --image-format=png --scale=$SCALE --gl=angle \
  --props="$PROPS" --log=error
T1=$(date +%s.%N)
N=$(ls "$FR" | wc -l)
echo "$ID frames=$N wall=$(echo "$T1 - $T0" | bc) per_frame=$(echo "scale=3; ($T1 - $T0) / $N" | bc)" | tee -a logs/render-times.txt
ffmpeg -v error -y -framerate 30 -i "$FR/element-%03d.png" -frames:v 600 -c:v libx264 -preset slow \
  -crf 16 -pix_fmt yuv420p -r 30 -an -movflags +faststart "renders/$FILE.mp4"
npx remotion still build "$ID" "out/cold/${ID}_300.png" --frame=300 --scale=$SCALE --gl=angle \
  --props="$PROPS" --log=error
npx remotion still build "$ID" "stills/$FILE.png" --frame=150 --scale=$SCALE --gl=angle --log=error
