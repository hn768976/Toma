#!/usr/bin/env bash
# Render the 720p previews used for verification.
# Each composition is rendered by Remotion as a PNG sequence (multi-threaded,
# out of order), then encoded with ffmpeg to H.264 / yuv420p / CRF 16 / 30 fps.
# Keeping the frames lets the verify step compare them byte for byte against
# cold single-frame renders. Loop compositions are rendered with
# {"loopCheck":true} (601 frames) so frame 600 can be compared with frame 0;
# only frames 0-599 go into the mp4.
#
#   scripts/render-previews.sh [CompositionId ...]
set -euo pipefail
cd "$(dirname "$0")/.."
SCALE=0.3333333333333333
ALL=(LockHUD-BlueOrange WaveMap-Teal WaveMap-Gold CommodityBoard-Blue EnergyBattery-Blue EnergyBattery-Green TradeChart-Tariffs TradeChart-Inflation)
IDS=("${@:-${ALL[@]}}")
[ $# -eq 0 ] && IDS=("${ALL[@]}")
mkdir -p out/previews out/frames out/stills
npx remotion bundle src/index.ts --out-dir=out/bundle --log=error >/dev/null
for id in "${IDS[@]}"; do
  name=${id/-/_}
  props='{}'; n=600; still=300
  case $id in WaveMap-*|EnergyBattery-*) props='{"loopCheck":true}';; TradeChart-*) n=450; still=420;; esac
  rm -rf "out/frames/$id"
  start=$(date +%s.%N)
  npx remotion render out/bundle "$id" "out/frames/$id" --sequence --image-format=png \
    --scale=$SCALE --props="$props" --log=error
  end=$(date +%s.%N)
  total=$(ls "out/frames/$id" | wc -l)
  echo "$id: $total frames in $(echo "$end - $start" | bc) s -> $(echo "scale=3; ($end - $start) / $total" | bc) s/frame" | tee -a out/timings.txt
  files=("out/frames/$id"/*.png)
  first=$(basename "${files[0]}")
  pat=${first%%[0-9]*.png}
  num=${first#"$pat"}; num=${num%.png}
  digits=${#num}
  ffmpeg -v error -y -framerate 30 -start_number 0 -i "out/frames/$id/${pat}%0${digits}d.png" -frames:v $n \
    -c:v libx264 -crf 16 -tune grain -pix_fmt yuv420p -r 30 -an -movflags +faststart "out/previews/$name.mp4"
  cp "out/frames/$id/${pat}$(printf "%0${digits}d" $still).png" "out/stills/$name.png"
done
