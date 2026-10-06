#!/usr/bin/env bash
# Render 720p previews: PNG sequence via Remotion (lossless, so frames can be
# compared byte for byte), then H.264 / yuv420p / CRF 16 / 30 fps with ffmpeg,
# plus a 720p PNG still (frame 300).
#
# usage: scripts/render-previews.sh <out-dir> [composition ...]
# env:   GL=angle (default) | swangle   SCALE=0.3333333333333333
set -euo pipefail
OUT=${1:?out dir}; shift || true
GL=${GL:-angle}
SCALE=${SCALE:-0.3333333333333333}
COMPS=("$@")
if [ ${#COMPS[@]} -eq 0 ]; then
  COMPS=(BigDataScreen-Blue DataWorldMap-BlueYellow FinanceInfographic-Teal SocialGlobe-Blue GlobalSecurityLock-Blue)
fi
mkdir -p "$OUT"
BUNDLE="$OUT/.bundle"
rm -rf "$BUNDLE"
npx remotion bundle --out-dir "$BUNDLE" >/dev/null
for c in "${COMPS[@]}"; do
  name=${c/-/_}                       # BigDataScreen-Blue -> BigDataScreen_Blue
  seq="$OUT/seq/$name"
  rm -rf "$seq"; mkdir -p "$seq"
  start=$(date +%s)
  npx remotion render "$BUNDLE" "$c" "$seq" --sequence --image-format=png \
    --scale="$SCALE" --gl="$GL" --concurrency=1 --log=error
  end=$(date +%s)
  n=$(ls "$seq" | wc -l)
  echo "$c: $n frames in $((end-start)) s" | tee -a "$OUT/render-times.txt"
  ffmpeg -v error -y -framerate 30 -i "$seq/element-%03d.png" \
    -c:v libx264 -preset slow -crf 16 -pix_fmt yuv420p -r 30 \
    -color_primaries bt709 -color_trc bt709 -colorspace bt709 \
    -vf "scale=out_color_matrix=bt709:out_range=tv" \
    -movflags +faststart -an "$OUT/$name.mp4"
  cp "$seq/element-300.png" "$OUT/${name}_still.png"
done
