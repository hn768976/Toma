#!/usr/bin/env bash
# Render one composition as a 720p preview and run the loop + determinism checks.
#   scripts/render-preview.sh <CompositionId> <OutputBaseName> [bundleDir]
# 1. Renders frames 0..600 (601-frame loop-check variant) as PNGs at 1280x720.
# 2. Loop check: frame 0 and frame 600 must have identical decoded pixels.
# 3. Encodes frames 0..599 to H.264 / yuv420p / CRF 16 / 30fps, no audio.
# 4. Determinism: renders frame 300 alone from a cold start and compares it
#    byte for byte (file and decoded pixels) with frame 300 of the sequence.
set -euo pipefail
COMP="$1"; NAME="$2"; BUNDLE="${3:-out/bundle}"
SCALE=0.3333333333333333
SEQ="out/seq/$COMP"; mkdir -p "$SEQ" out/previews out/stills out/cold out/logs
rm -f "$SEQ"/*.png
PROPS="{\"id\":\"$COMP\",\"loopCheck\":true}"
t0=$(date +%s.%N)
npx remotion render "$BUNDLE" "$COMP" "$SEQ" --sequence --image-format=png --props="$PROPS" \
  --scale=$SCALE --concurrency=${CONCURRENCY:-2} --log=error > "out/logs/$COMP.render.log" 2>&1
t1=$(date +%s.%N)
n=$(ls "$SEQ"/*.png | wc -l)
perframe=$(echo "($t1 - $t0) / $n" | bc -l)
first=$(ls "$SEQ"/*.png | head -1); last=$(ls "$SEQ"/*.png | tail -1)
pad=$(basename "$first" .png | sed 's/[^0-9]//g' | wc -c); pad=$((pad - 1))
f300="$SEQ/element-$(printf "%0${pad}d" 300).png"
md5px() { ffmpeg -v error -i "$1" -f framemd5 - | grep -v '^#' | awk -F, '{print $NF}' | tr -d ' '; }
loop="FAIL"; [ "$(md5px "$first")" = "$(md5px "$last")" ] && loop="PASS"
# encode the 600-frame loop
ffmpeg -v error -y -framerate 30 -start_number 0 -i "$SEQ/element-%0${pad}d.png" -frames:v 600 \
  -c:v libx264 -pix_fmt yuv420p -crf 16 -preset slow -r 30 -an -movflags +faststart "out/previews/$NAME.mp4"
cp "$f300" "out/stills/$NAME.png"
# cold still of frame 300
npx remotion still "$BUNDLE" "$COMP" "out/cold/$COMP-300.png" --frame=300 --props="{\"id\":\"$COMP\",\"loopCheck\":false}" \
  --scale=$SCALE --image-format=png --log=error > "out/logs/$COMP.still.log" 2>&1
det="FAIL"; cmp -s "$f300" "out/cold/$COMP-300.png" && det="PASS(bytes)"
[ "$det" = "FAIL" ] && [ "$(md5px "$f300")" = "$(md5px "out/cold/$COMP-300.png")" ] && det="PASS(pixels)"
printf "%s\tframes=%d\tsec/frame=%.3f\tloop0v600=%s\tframe300cold=%s\n" "$COMP" "$n" "$perframe" "$loop" "$det" | tee -a out/logs/summary.tsv
