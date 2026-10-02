#!/usr/bin/env bash
# Full preview + verification pass for ONE composition.
# Usage: scripts/verify-one.sh <compositionId> <OutputName> <outDir>
#   1. 720p preview mp4 (H.264, yuv420p, CRF 16, 30 fps) via `remotion render --scale=1/3`
#   2. ffprobe report
#   3. full PNG-sequence render (concurrency 4, out of order) -> keep frame 300
#   4. frame 300 rendered on its own from a cold start -> byte compare
#   5. loop check: 601-frame variant, frames 0 and 600 -> pixel compare
#   6. 720p PNG still
set -uo pipefail
ID=$1; NAME=$2; OUT=$3
SCALE=0.3333333333333333
mkdir -p "$OUT/previews" "$OUT/stills-720p" "$OUT/checks/$NAME" "$OUT/logs"
LOG="$OUT/logs/$NAME.log"
C="$OUT/checks/$NAME"
: > "$LOG"

t0=$(date +%s.%N)
npx remotion render "$ID" "$OUT/previews/$NAME.mp4" --scale=$SCALE --codec=h264 --crf=16 --pixel-format=yuv420p --muted --concurrency=4 --log=error >>"$LOG" 2>&1
t1=$(date +%s.%N)
echo "render_mp4_seconds $(echo "$t1 - $t0" | bc)" >> "$C/report.txt"

ffprobe -v error -show_entries stream=codec_name,codec_type,width,height,r_frame_rate,pix_fmt,nb_frames \
  -show_entries format=duration -of default=noprint_wrappers=1 "$OUT/previews/$NAME.mp4" > "$C/ffprobe.txt"

rm -rf "$C/seq"
npx remotion render "$ID" "$C/seq" --sequence --image-format=png --scale=$SCALE --concurrency=4 --log=error >>"$LOG" 2>&1
F300=$(ls "$C/seq" | grep -E '(^|[^0-9])0*300\.png$' | head -1)
cp "$C/seq/$F300" "$C/full_300.png"
rm -rf "$C/seq"

npx remotion still "$ID" "$C/cold_300.png" --frame=300 --scale=$SCALE --log=error >>"$LOG" 2>&1
if cmp -s "$C/full_300.png" "$C/cold_300.png"; then echo "frame300_bytes IDENTICAL" >> "$C/report.txt"; else echo "frame300_bytes DIFFERENT" >> "$C/report.txt"; fi

npx remotion still "$ID" "$C/loop_000.png" --frame=0 --scale=$SCALE --props='{"loopCheck":true}' --log=error >>"$LOG" 2>&1
npx remotion still "$ID" "$C/loop_600.png" --frame=600 --scale=$SCALE --props='{"loopCheck":true}' --log=error >>"$LOG" 2>&1
if cmp -s "$C/loop_000.png" "$C/loop_600.png"; then echo "loop_0_vs_600_bytes IDENTICAL" >> "$C/report.txt"; else echo "loop_0_vs_600_bytes DIFFERENT" >> "$C/report.txt"; fi

npx remotion still "$ID" "$OUT/stills-720p/$NAME.png" --frame=150 --scale=$SCALE --log=error >>"$LOG" 2>&1
echo "done $NAME"
