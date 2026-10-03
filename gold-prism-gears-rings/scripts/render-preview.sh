#!/usr/bin/env bash
# Render a 720p preview of one composition as a lossless PNG sequence, then
# encode it to H.264 (CRF 16, yuv420p, 30 fps). Keeps frame 300 for the
# determinism check and prints the measured render time per frame.
#
#   scripts/render-preview.sh <CompositionId> <OutName> [bundleDir]
set -euo pipefail
ID=$1
NAME=$2
BUNDLE=${3:-out/bundle}
SCALE=0.3333333333333333
mkdir -p out/frames/$NAME out/previews out/stills
if [ "${ENCODE_ONLY:-0}" != 1 ]; then
rm -f out/frames/$NAME/*.png
start=$(date +%s.%N)
npx remotion render "$BUNDLE" "$ID" "out/frames/$NAME" --sequence --image-format=png \
  --scale=$SCALE --gl=angle --concurrency=1 --log=error
end=$(date +%s.%N)
n=$(ls out/frames/$NAME/*.png | wc -l)
python3 - "$start" "$end" "$n" "$NAME" <<'PY'
import sys
s, e, n, name = float(sys.argv[1]), float(sys.argv[2]), int(sys.argv[3]), sys.argv[4]
print(f"TIMING {name}: {n} frames in {e-s:.1f}s = {(e-s)/n:.3f} s/frame (720p, incl. startup)")
PY
fi
pattern="out/frames/$NAME/element-"
ffmpeg -v error -y -framerate 30 -i "${pattern}%03d.png" -c:v libx264 -crf 16 -preset slow \
  -pix_fmt yuv420p -color_primaries bt709 -color_trc bt709 -colorspace bt709 -movflags +faststart -an \
  out/previews/$NAME.mp4
cp "${pattern}300.png" out/frames/${NAME}_full_300.png
cp "${pattern}150.png" out/stills/$NAME.png
rm -f out/frames/$NAME/*.png
echo "DONE $NAME"
