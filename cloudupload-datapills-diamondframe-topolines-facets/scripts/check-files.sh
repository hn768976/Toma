#!/usr/bin/env bash
# Step 1: 1280x720, 30/1, h264, yuv420p, no audio, 20.0 s.
cd "$(dirname "$0")/.."
source scripts/ids.sh
fail=0
for id in ${*:-$ALL_IDS}; do
  f="out/previews/$(fname "$id").mp4"
  info=$(ffprobe -v error -show_entries stream=codec_type,codec_name,width,height,r_frame_rate,pix_fmt \
    -show_entries format=duration -of default=noprint_wrappers=1 "$f")
  v=$(echo "$info" | tr '\n' ' ')
  ok=1
  echo "$info" | grep -q "codec_name=h264" || ok=0
  echo "$info" | grep -q "width=1280" || ok=0
  echo "$info" | grep -q "height=720" || ok=0
  echo "$info" | grep -q "r_frame_rate=30/1" || ok=0
  echo "$info" | grep -q "pix_fmt=yuv420p" || ok=0
  echo "$info" | grep -q "codec_type=audio" && ok=0
  echo "$info" | grep -Eq "duration=20\.0+$" || ok=0
  [ $ok = 1 ] && echo "PASS $f" || { echo "FAIL $f :: $v"; fail=1; }
done
exit $fail
