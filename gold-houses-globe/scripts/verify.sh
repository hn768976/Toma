#!/usr/bin/env bash
# Verification of the rendered 720p previews (run after scripts/render-all.sh).
#   1. file checks (ffprobe)           -> out/checks/files.txt
#   2. loop check: frame 600 == frame 0 (looping comps, --props loopCheck)
#   3. determinism: cold still of frame 200 == frame 200 of the full sequence
#   5. five evenly spaced frames per composition -> out/checks/sheets/<name>.png
# env: BROWSER_EXECUTABLE (optional)
set -uo pipefail
cd "$(dirname "$0")/.."
BX=(); [ -n "${BROWSER_EXECUTABLE:-}" ] && BX=(--browser-executable="$BROWSER_EXECUTABLE")
S=(--scale=0.3333333333333333 --gl=angle --log=error)
mkdir -p out/checks/sheets
declare -A ID=( [LowPolyLuxe_Gold]=LowPolyLuxe-Gold [LowPolyLuxe_Silver]=LowPolyLuxe-Silver
  [CloudUpload]=CloudUpload [PriceHouses_Dollar]=PriceHouses-Dollar [PriceHouses_Euro]=PriceHouses-Euro
  [NetworkGrowth]=NetworkGrowth [ConnectedGlobe]=ConnectedGlobe )
NAMES=(LowPolyLuxe_Gold LowPolyLuxe_Silver CloudUpload PriceHouses_Dollar PriceHouses_Euro NetworkGrowth ConnectedGlobe)
[ $# -gt 0 ] && NAMES=("$@")

for n in "${NAMES[@]}"; do
  f="out/previews/$n.mp4"
  echo "== $n"
  echo "-- step 1: $(ffprobe -v error -show_entries stream=codec_type,codec_name,width,height,r_frame_rate,pix_fmt \
    -show_entries format=duration -of compact=p=0:nk=0 "$f" | tr '\n' ' ')"
  nstreams=$(ffprobe -v error -show_entries stream=index -of csv=p=0 "$f" | wc -l)
  echo "   streams=$nstreams (1 = video only, no audio)"
  if [ "$n" != NetworkGrowth ]; then
    for fr in 0 600; do
      npx remotion still src/index.ts "${ID[$n]}" "out/checks/${n}_loop$fr.png" --frame=$fr \
        --props='{"loopCheck":true}' "${S[@]}" "${BX[@]}" >/dev/null 2>&1
    done
    echo "-- step 2 (frame 0 vs 600): $(python3 scripts/compare.py "out/checks/${n}_loop0.png" "out/checks/${n}_loop600.png")"
  fi
  npx remotion still src/index.ts "${ID[$n]}" "out/checks/${n}_f200_cold.png" --frame=200 "${S[@]}" "${BX[@]}" >/dev/null 2>&1
  echo "-- step 3 (cold frame 200 vs sequence): $(python3 scripts/compare.py "out/checks/${n}_f200_cold.png" "out/frames/$n/element-200.png")"
  dur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$f")
  ffmpeg -v error -y -i "$f" -vf "select='eq(n\,0)+eq(n\,$(python3 -c "print(int($dur*30*0.25))"))+eq(n\,$(python3 -c "print(int($dur*30*0.5))"))+eq(n\,$(python3 -c "print(int($dur*30*0.75))"))+eq(n\,$(python3 -c "print(int($dur*30)-1)"))',scale=640:360,tile=5x1" \
    -frames:v 1 -vsync vfr "out/checks/sheets/$n.png"
done
