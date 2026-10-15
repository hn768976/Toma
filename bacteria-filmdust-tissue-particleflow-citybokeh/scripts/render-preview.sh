#!/bin/bash
# render-preview.sh <CompositionId> [OutName]
# 720p preview: Remotion renders a PNG sequence at --scale=1/3 (1280x720), then
# ffmpeg encodes H.264 CRF 16 yuv420p 30 fps with no audio. The PNG frames are
# kept so frame 300 can be compared byte-for-byte with a cold-start still.
set -euo pipefail
cd "$(dirname "$0")/.."
ID="$1"
NAME="${2:-${ID/-/_}}"
OUT=renders
mkdir -p "$OUT/frames/$NAME" "$OUT/previews" "$OUT/logs"
B=${BUNDLE:-renders/bundle}
[ -d "$B" ] || npx remotion bundle --out-dir "$B" >/dev/null
start=$(date +%s.%N)
npx remotion render "$B" "$ID" "$OUT/frames/$NAME" --sequence --image-format=png \
  --scale=0.3333333333333333 --concurrency=${CONCURRENCY:-4} --gl=angle --log=error >"$OUT/logs/$NAME.log" 2>&1
end=$(date +%s.%N)
ffmpeg -v error -y -framerate 30 -i "$OUT/frames/$NAME/element-%03d.png" \
  -vf "scale=out_color_matrix=bt709:out_range=tv,format=yuv420p" \
  -c:v libx264 -preset slow -crf 16 -pix_fmt yuv420p -r 30 -an \
  -colorspace bt709 -color_primaries bt709 -color_trc bt709 -movflags +faststart \
  "$OUT/previews/$NAME.mp4"
cp "$OUT/frames/$NAME/element-300.png" "$OUT/previews/$NAME.png"
python3 -c "print('$NAME render wall %.1fs = %.0f ms/frame' % (($end-$start), ($end-$start)*1000/600))" | tee -a "$OUT/logs/timings.txt"
