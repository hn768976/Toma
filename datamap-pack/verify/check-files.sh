#!/bin/bash
# Step 1: 1280x720, 30/1, h264, yuv420p, no audio, 20.0 s.
cd "$(dirname "$0")/.."
for f in out/previews/*.mp4; do
  info=$(ffprobe -v error -show_entries stream=codec_type,codec_name,width,height,r_frame_rate,pix_fmt \
    -show_entries format=duration -of default=noprint_wrappers=1 "$f")
  ok=PASS
  echo "$info" | grep -q "width=1280" || ok=FAIL
  echo "$info" | grep -q "height=720" || ok=FAIL
  echo "$info" | grep -q "r_frame_rate=30/1" || ok=FAIL
  echo "$info" | grep -q "codec_name=h264" || ok=FAIL
  echo "$info" | grep -q "pix_fmt=yuv420p" || ok=FAIL
  echo "$info" | grep -q "codec_type=audio" && ok=FAIL
  d=$(echo "$info" | sed -n 's/duration=//p')
  python3 -c "import sys; sys.exit(0 if abs(float('$d')-20.0)<0.001 else 1)" || ok=FAIL
  echo "$ok $(basename "$f") $(echo $info | tr '\n' ' ')"
done
