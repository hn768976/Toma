#!/usr/bin/env bash
# Runs the verify loop on the rendered previews. Needs renders/ (tools/render-previews.sh)
# and out/seq/ (tools/full-sequences.sh). Prints a PASS/FAIL line per check.
set -uo pipefail
cd "$(dirname "$0")/.."
C="python3 -I tools/checks.py"
fail=0
declare -A DUR=([PhoneDropIn_GreenScreen]=10 [PhoneDropIn_PastelGradient]=10 [PhoneSway_GreenScreen]=20
  [PhoneSway_PastelPink]=20 [PhoneTumbleLand_GreenScreen]=10 [PhoneTumbleLand_WhiteStudio]=10 [PhoneGrid_White]=20)

echo "== Step 1: file checks"
for n in "${!DUR[@]}"; do
  f=renders/$n.mp4
  v=$(ffprobe -v error -select_streams v:0 -show_entries stream=codec_name,width,height,r_frame_rate,pix_fmt -of csv=p=0 "$f")
  a=$(ffprobe -v error -select_streams a -show_entries stream=index -of csv=p=0 "$f" | wc -l)
  d=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$f")
  ok=PASS
  [ "$v" = "h264,1280,720,yuv420p,30/1" ] || ok=FAIL
  [ "$a" = "0" ] || ok=FAIL
  awk -v d="$d" -v e="${DUR[$n]}" 'BEGIN{exit !(d==e)}' || ok=FAIL
  [ $ok = PASS ] || fail=1
  echo "$n: $v audio_streams=$a duration=$d -> $ok"
done

echo "== Step 2: loop check (601-frame render, frame 600 vs frame 0)"
for id in PhoneSway-GreenScreen PhoneSway-PastelPink PhoneGrid-White; do
  echo -n "$id: "; $C same out/seq/$id/element-000.png out/seq/$id/element-600.png | tr '\n' ' '; echo
  cmp -s out/seq/$id/element-000.png out/seq/$id/element-600.png && echo "   bytes identical" || { echo "   bytes differ"; fail=1; }
done

echo "== Step 3: frame 150 cold still vs frame 150 of the full render"
for n in "${!DUR[@]}"; do
  id=${n//_/-}
  if cmp -s "renders/$n.png" "out/seq/$id/element-150.png"; then echo "$n: bytes identical -> PASS"; else echo "$n: DIFFER -> FAIL"; fail=1; fi
done

echo "== Step 4: green, banding, key"
for n in "${!DUR[@]}"; do
  N=$((DUR[$n] * 30))
  echo "-- $n"
  $C green renders/$n.mp4 0 $((N / 4)) $((N / 2)) $((3 * N / 4)) $((N - 1)) | grep -v "edge band" || fail=1
done
$C band renders/PhoneDropIn_PastelGradient.mp4 280 || fail=1
$C band renders/PhoneSway_PastelPink.mp4 300 || fail=1
$C band renders/PhoneTumbleLand_WhiteStudio.mp4 150 || fail=1
$C band renders/PhoneTumbleLand_WhiteStudio.mp4 290 || fail=1
$C band renders/PhoneGrid_White.mp4 300 margin || fail=1
mkdir -p out/key
for n in PhoneDropIn_GreenScreen PhoneSway_GreenScreen PhoneTumbleLand_GreenScreen; do
  out=$($C key renders/$n.mp4 150 out/key/$n.png) || fail=1
  echo "key $n: $(tr '\n' ' ' <<<"$out")"
done

echo "== RESULT: $([ $fail = 0 ] && echo ALL PASS || echo SOMETHING FAILED)"
exit $fail
