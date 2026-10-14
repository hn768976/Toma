#!/usr/bin/env bash
# Verify loop helpers. Usage: scripts/verify.sh <step> <CompId>
#   probe | loop | determinism | contact | motion
set -euo pipefail
cd "$(dirname "$0")/.."
GL="${GL:-angle}"
SCALE=0.3333333333333333
step=$1; id=$2; name="${id//-/_}"
V=out/verify/$name; mkdir -p "$V"
mid=300; [ "$id" = "CloudMap-Story" ] && mid=150
case $step in
  probe)
    ffprobe -v error -show_entries stream=codec_name,codec_type,width,height,r_frame_rate,pix_fmt \
      -show_entries format=duration -of default=noprint_wrappers=1 "out/previews/$name.mp4" ;;
  loop)
    # Temporarily 601 frames (extraFrames=1); frame 600 must equal frame 0 pixel for pixel.
    for f in 0 600; do
      npx remotion still src/index.ts "$id" "$V/loop_$f.png" --frame=$f --scale=$SCALE --gl="$GL" \
        --props='{"extraFrames":1}' --log=error >/dev/null 2>&1
    done
    python3 scripts/compare.py "$V/loop_0.png" "$V/loop_600.png" ;;
  determinism)
    # Cold single-frame render vs. the same frame inside a multi-threaded sequence render.
    npx remotion still src/index.ts "$id" "$V/cold_$mid.png" --frame=$mid --scale=$SCALE --gl="$GL" --log=error >/dev/null 2>&1
    rm -rf "$V/seq"; mkdir -p "$V/seq"
    npx remotion render src/index.ts "$id" "$V/seq" --sequence --image-format=png --frames=$((mid-20))-$((mid+20)) \
      --scale=$SCALE --gl="$GL" --concurrency=4 --log=error >/dev/null 2>&1
    f=$(ls "$V/seq" | grep -E "0*${mid}\.png$" | head -1)
    python3 scripts/compare.py "$V/cold_$mid.png" "$V/seq/$f" ;;
  contact)
    n=600; [ "$id" = "CloudMap-Story" ] && n=300
    python3 scripts/contact.py "out/previews/$name.mp4" $n "out/verify/${name}_contact.png" ;;
esac
