#!/usr/bin/env bash
# 720p previews of all 8 compositions (scale 1/3 of the 3840x2160 compositions).
# Each composition is rendered by Remotion as a full PNG sequence (out of order,
# multi-threaded — the real render path), then encoded with ffmpeg:
# H.264, yuv420p, 30 fps, CRF 16, no audio. The PNG sequence is kept so that
# frame 200 can be compared byte-for-byte with a cold `remotion still`.
set -euo pipefail
cd "$(dirname "$0")/.."
SCALE=0.3333333333333333
OUT=out/previews
mkdir -p "$OUT"
ALL="GlitterSmoke-Blue GlitterSmoke-VioletGold NeonPolygonFrame CrowdSpotlight-Blue CrowdSpotlight-Gold AIBrainPaths GlassTwist-IceBlue GlassTwist-Blush"
COMPS=${*:-$ALL}
for id in $COMPS; do
  name=${id//-/_}
  seq="out/seq/$name"
  rm -rf "$seq"; mkdir -p "$seq"
  start=$(date +%s)
  npx remotion render "$id" "$seq" --sequence --image-format=png --scale=$SCALE --log=error
  end=$(date +%s)
  n=$(ls "$seq" | wc -l)
  echo "$id: $n frames in $((end-start)) s ($(echo "scale=3; ($end-$start)/$n" | bc) s/frame)" | tee -a out/render-times.txt
  ffmpeg -v error -y -framerate 30 -pattern_type glob -i "$seq/*.png" \
    -c:v libx264 -preset slow -crf 16 -pix_fmt yuv420p -r 30 -an -movflags +faststart "$OUT/$name.mp4"
  mid=$(ls "$seq" | sort | sed -n "$((n * 3 / 4))p")
  cp "$seq/$mid" "$OUT/$name.png"
done
