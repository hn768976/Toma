#!/usr/bin/env bash
# Steps 1, 3, 5 and 6 on the encoded previews in out/previews.
set -uo pipefail
cd "$(dirname "$0")/.."
V=out/previews
mkdir -p out/verify/frames out/verify/sheets
declare -A DUR=([GrainGlow]=20.0 [PlexusSphere]=15.0 [HexMosaic]=8.0 [NeonBadge]=20.0)

echo "== Step 1: file checks"
for f in $V/*.mp4; do
  n=$(basename "$f" .mp4); look=${n%%_*}
  info=$(ffprobe -v error -show_entries stream=codec_type,codec_name,width,height,r_frame_rate,pix_fmt \
    -show_entries format=duration -of default=noprint_wrappers=1 "$f")
  v=$(echo "$info" | grep -c codec_type=video); a=$(echo "$info" | grep -c codec_type=audio)
  w=$(echo "$info" | sed -n 's/^width=//p'); h=$(echo "$info" | sed -n 's/^height=//p')
  r=$(echo "$info" | sed -n 's/^r_frame_rate=//p'); p=$(echo "$info" | sed -n 's/^pix_fmt=//p')
  c=$(echo "$info" | sed -n 's/^codec_name=//p' | head -1); d=$(echo "$info" | sed -n 's/^duration=//p')
  dd=$(printf "%.1f" "$d")
  ok=PASS
  [ "$w" = 1920 ] && [ "$h" = 1080 ] && [ "$r" = 30/1 ] && [ "$c" = h264 ] && [ "$p" = yuv420p ] && [ "$v" = 1 ] && [ "$a" = 0 ] && [ "$dd" = "${DUR[$look]}" ] || ok=FAIL
  echo "$ok $n: ${w}x${h} $r $c $p video=$v audio=$a duration=${d}s (want ${DUR[$look]})"
done

echo "== Step 3: black check from the mp4 (look 3)"
for n in HexMosaic_Blue HexMosaic_Gold; do
  for fr in 0 230 50; do
    ffmpeg -v error -y -i "$V/$n.mp4" -vf "select=eq(n\,$fr)" -frames:v 1 "out/verify/frames/${n}_mp4_$fr.png"
  done
  python3 scripts/check_black.py 1 "out/verify/frames/${n}_mp4_0.png"
  python3 scripts/check_black.py 1 "out/verify/frames/${n}_mp4_230.png"
  for corner in "0 0 240 135" "1680 0 1920 135" "0 945 240 1080" "1680 945 1920 1080"; do
    python3 scripts/check_black.py 1 "out/verify/frames/${n}_mp4_50.png" $corner | sed "s/\$/ corner [$corner]/"
  done
done

echo "== Step 5: banding (frames from the mp4)"
for nf in GrainGlow_Violet:300 GrainGlow_Sunset:300 PlexusSphere_BlueViolet:420 NeonBadge_MadeByHuman:200; do
  n=${nf%%:*}; fr=${nf##*:}
  ffmpeg -v error -y -i "$V/$n.mp4" -vf "select=eq(n\,$fr)" -frames:v 1 "out/verify/frames/${n}_band_$fr.png"
  python3 scripts/banding.py "out/verify/frames/${n}_band_$fr.png"
done

echo "== Step 6: five evenly spaced frames per preview -> out/verify/sheets"
for f in $V/*.mp4; do
  n=$(basename "$f" .mp4)
  total=$(ffprobe -v error -count_frames -select_streams v:0 -show_entries stream=nb_read_frames -of csv=p=0 "$f")
  sel=""; for k in 0 1 2 3 4; do i=$(( (total - 1) * k / 4 )); sel="$sel+eq(n\,$i)"; done
  ffmpeg -v error -y -i "$f" -vf "select='${sel:1}',scale=640:-1,tile=5x1" -frames:v 1 "out/verify/sheets/$n.png"
  echo "$n: frames $(echo "$sel" | grep -o '[0-9]*)' | tr -d ')' | tr '\n' ' ') of $total"
done
