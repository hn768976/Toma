#!/usr/bin/env bash
# Render one composition's 720p preview and run the loop / determinism checks.
#   scripts/render-verify.sh <CompositionId> [bundleDir]
# 1. renders 601 frames (loopTest) as a PNG sequence at 1280x720, 2 tabs in parallel
# 2. frame 600 must equal frame 0 pixel for pixel   (loop check)
# 3. encodes frames 0-599 → H.264 / yuv420p / CRF 16 / 30 fps mp4
# 4. renders frame 300 alone from a cold start; must match the sequence's frame 300 byte for byte
set -euo pipefail
ID="$1"
BUNDLE="${2:-out/bundle}"
NAME="${ID/-/_}"
SCALE=0.3333333333333333
OUT=renders
FR="$OUT/frames-$ID"
mkdir -p "$OUT" "$FR"
rm -f "$FR"/*.png
LOG="$OUT/$NAME.verify.txt"
: > "$LOG"

t0=$(date +%s.%N)
npx remotion render "$BUNDLE" "$ID" "$FR" --sequence --image-format=png \
  --props='{"loopTest":true}' --scale=$SCALE --concurrency=2 --log=error
t1=$(date +%s.%N)
n=$(ls "$FR"/*.png | wc -l)
echo "frames=$n render_seconds=$(echo "$t1 - $t0" | bc) per_frame=$(echo "($t1 - $t0) / $n" | bc -l | cut -c1-5)" | tee -a "$LOG"

first=$(ls "$FR"/*.png | head -1)
last=$(ls "$FR"/*.png | tail -1)
pat=$(basename "$first" | sed -E 's/[0-9]+\.png$//')
digits=$(basename "$first" | sed -E "s/^$pat//; s/\.png$//" | wc -c); digits=$((digits-1))
f300="$FR/$(printf "%s%0${digits}d.png" "$pat" 300)"

# loop check (decoded pixels, not file bytes)
if python3 -I -c "import sys; from PIL import Image, ImageChops; a=Image.open(sys.argv[1]).convert('RGB'); b=Image.open(sys.argv[2]).convert('RGB'); sys.exit(0 if ImageChops.difference(a,b).getbbox() is None else 1)" "$first" "$last"; then
  echo "loop: frame0 == frame600 PASS" | tee -a "$LOG"
else
  echo "loop: frame0 != frame600 FAIL" | tee -a "$LOG"
fi

# encode the 600-frame loop
ffmpeg -v error -y -framerate 30 -start_number 0 -i "$FR/${pat}%0${digits}d.png" -frames:v 600 \
  -c:v libx264 -crf 16 -pix_fmt yuv420p -preset slow -movflags +faststart -an "$OUT/$NAME.mp4"

# cold single-frame render of 300
npx remotion still "$BUNDLE" "$ID" "$OUT/$NAME.cold300.png" --frame=300 --scale=$SCALE --log=error
if cmp -s "$OUT/$NAME.cold300.png" "$f300"; then
  echo "determinism: cold frame 300 == sequence frame 300 (byte-identical PNG) PASS" | tee -a "$LOG"
else
  echo "determinism: cold frame 300 differs from sequence frame 300 FAIL" | tee -a "$LOG"
fi
cp "$f300" "$OUT/$NAME.png"
rm -f "$OUT/$NAME.cold300.png"
rm -rf "$FR"
ffprobe -v error -show_entries stream=codec_type,codec_name,width,height,r_frame_rate,pix_fmt \
  -show_entries format=duration -of default=noprint_wrappers=1 "$OUT/$NAME.mp4" | tee -a "$LOG"
