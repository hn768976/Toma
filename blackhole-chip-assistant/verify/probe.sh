#!/usr/bin/env bash
# Step 1: basic file checks. Usage: verify/probe.sh file.mp4 expected_seconds
f="$1"; want="$2"
out=$(ffprobe -v error -show_entries stream=codec_type,codec_name,pix_fmt,width,height,r_frame_rate \
  -show_entries format=duration -of default=noprint_wrappers=1 "$f")
echo "$out" | sed 's/^/  /'
fail=0
grep -q '^codec_name=h264$' <<<"$out" || { echo "  FAIL codec"; fail=1; }
grep -q '^pix_fmt=yuv420p$' <<<"$out" || { echo "  FAIL pix_fmt"; fail=1; }
grep -q '^width=1920$' <<<"$out" || { echo "  FAIL width"; fail=1; }
grep -q '^height=1080$' <<<"$out" || { echo "  FAIL height"; fail=1; }
grep -q '^r_frame_rate=30/1$' <<<"$out" || { echo "  FAIL fps"; fail=1; }
grep -q '^codec_type=audio$' <<<"$out" && { echo "  FAIL has audio"; fail=1; }
d=$(grep '^duration=' <<<"$out" | cut -d= -f2)
awk -v d="$d" -v w="$want" 'BEGIN{exit !(d>=w-0.001 && d<=w+0.001)}' || { echo "  FAIL duration $d != $want"; fail=1; }
n=$(ffprobe -v error -count_frames -select_streams v:0 -show_entries stream=nb_read_frames -of csv=p=0 "$f")
echo "  frames=$n"
[ $fail = 0 ] && echo "  PASS $f" || echo "  FAILED $f"
exit $fail
