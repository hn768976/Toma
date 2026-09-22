#!/usr/bin/env bash
# Steps 1, 5, 6 and 7 of the verify loop, run against the encoded mp4s.
set -u
cd "$(dirname "$0")"
V=out/video
mkdir -p out/frames out/scale

echo "===== Step 1: objective checks (ffprobe on the encoded files) ====="
for f in "$V"/*.mp4; do
  n=$(basename "$f")
  info=$(ffprobe -v error -show_entries stream=codec_type,codec_name,width,height,r_frame_rate,pix_fmt \
        -show_entries format=duration -of default=noprint_wrappers=1 "$f")
  w=$(grep -m1 '^width=' <<<"$info" | cut -d= -f2)
  h=$(grep -m1 '^height=' <<<"$info" | cut -d= -f2)
  fps=$(grep -m1 '^r_frame_rate=' <<<"$info" | cut -d= -f2)
  cod=$(grep -m1 '^codec_name=' <<<"$info" | cut -d= -f2)
  pix=$(grep -m1 '^pix_fmt=' <<<"$info" | cut -d= -f2)
  dur=$(grep -m1 '^duration=' <<<"$info" | cut -d= -f2)
  aud=$(grep -c 'codec_type=audio' <<<"$info")
  case "$n" in GrowthLine_*) want=10.0;; *) want=20.0;; esac
  ok=1
  [ "$w" = "1920" ] && [ "$h" = "1080" ] || ok=0
  [ "$fps" = "30/1" ] || ok=0
  [ "$cod" = "h264" ] || ok=0
  [ "$pix" = "yuv420p" ] || ok=0
  [ "$aud" = "0" ] || ok=0
  python3 -c "import sys; sys.exit(0 if abs($dur-$want)<0.02 else 1)" || ok=0
  [ $ok = 1 ] && st=PASS || st=FAIL
  printf '%-6s %-30s %sx%s %s %s %s dur=%ss audio=%s\n' "$st" "$n" "$w" "$h" "$fps" "$cod" "$pix" "$dur" "$aud"
done

echo
echo "===== Step 6: banding (frames extracted FROM the encoded mp4) ====="
for f in "$V"/*.mp4; do
  n=$(basename "$f" .mp4)
  ffmpeg -v error -ss 4 -i "$f" -frames:v 1 -y "out/frames/${n}_band.png"
  python3 analyze-banding.py "out/frames/${n}_band.png" "$n"
done

echo
echo "===== Step 7: per-look frames (0/150/300/450/599, or 0/75/150/225/299) ====="
declare -A IDS=( [GrowthLine_Navy]=GrowthLine-Navy [GrowthLine_Black]=GrowthLine-Black \
  [BarChart_Cyan]=BarChart-Cyan [BarChart_Amber]=BarChart-Amber \
  [DarkDashboard_Teal]=DarkDashboard-Teal [DarkDashboard_Blue]=DarkDashboard-Blue \
  [LightDashboard_Warm]=LightDashboard-Warm [LightDashboard_Slate]=LightDashboard-Slate \
  [FinancialMontage_Blue]=FinancialMontage-Blue )
for n in "${!IDS[@]}"; do
  case "$n" in GrowthLine_*) FR="0 75 150 225 299";; *) FR="0 150 300 450 599";; esac
  for fr in $FR; do
    npx remotion still "${IDS[$n]}" "out/frames/${n}_f${fr}.png" --frame="$fr" --scale=0.5 --image-format=png >/dev/null 2>&1
  done
  echo "extracted $n: $FR"
done

echo
echo "===== Step 5: resolution scaling (looks 3 and 4, 1080p vs 4K) ====="
for id in DarkDashboard-Teal LightDashboard-Warm; do
  npx remotion still "$id" "out/scale/${id}_1080.png" --frame=300 --scale=0.5  --image-format=png >/dev/null 2>&1
  npx remotion still "$id" "out/scale/${id}_4k.png"   --frame=300 --scale=1    --image-format=png >/dev/null 2>&1
  ffmpeg -v error -i "out/scale/${id}_4k.png" -vf scale=1920:1080:flags=lanczos -y "out/scale/${id}_4k_down.png"
  python3 -c "
import subprocess,sys
a='out/scale/${id}_1080.png'; b='out/scale/${id}_4k_down.png'
o=subprocess.run(['ffmpeg','-v','error','-i',a,'-i',b,'-filter_complex','blend=all_mode=difference,format=gray','-f','rawvideo','-pix_fmt','gray','-'],capture_output=True).stdout
big=sum(1 for v in o if v>40)
print(f'  ${id}: layout diff pixels >40/255 = {big} of {len(o)} ({100*big/len(o):.3f}%) -- a reflow would put this in the percent range')
"
done
