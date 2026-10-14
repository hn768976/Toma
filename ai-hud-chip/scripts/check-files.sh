#!/usr/bin/env bash
# Step 1 — basic file checks on the 720p previews.
# usage: scripts/check-files.sh out/previews
set -u
DIR=${1:-out/previews}
declare -A DUR=( [AIHudPlane_Violet]=15 [AIHudPlane_Teal]=15 [ParticleAIChip_Blue]=20 [AIChipReveal_Blue]=10 [AIChipReveal_Amber]=10 )
fail=0
for name in "${!DUR[@]}"; do
  f="$DIR/$name.mp4"
  if [ ! -f "$f" ]; then echo "MISSING $f"; fail=1; continue; fi
  v=$(ffprobe -v error -select_streams v:0 -show_entries stream=codec_name,width,height,r_frame_rate,pix_fmt -of default=nw=1:nk=1 "$f" | paste -sd, -)
  a=$(ffprobe -v error -select_streams a -show_entries stream=index -of csv=p=0 "$f" | wc -l)
  d=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$f")
  want="h264,1280,720,yuv420p,30/1"
  ok=PASS
  [ "$v" = "$want" ] || ok=FAIL
  [ "$a" = "0" ] || ok=FAIL
  awk -v d="$d" -v w="${DUR[$name]}" 'BEGIN{exit !(d>=w-0.02 && d<=w+0.02)}' || ok=FAIL
  [ "$ok" = PASS ] || fail=1
  printf "%-22s %s  video=%s audio_streams=%s duration=%ss (want %ss)\n" "$name" "$ok" "$v" "$a" "$d" "${DUR[$name]}"
done
exit $fail
