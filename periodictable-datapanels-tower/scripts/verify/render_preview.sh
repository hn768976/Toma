#!/usr/bin/env bash
# Renders one composition's 720p preview:
#   1. full PNG sequence at --scale=1/3 (1280×720) with Remotion, timed
#   2. encodes it to H.264 / yuv420p / 30 fps / CRF 16 with ffmpeg
#   3. keeps the full render's middle frame (for the determinism check)
# usage: scripts/verify/render_preview.sh <CompositionId> <OutName> <frames>
set -euo pipefail
ID=$1; NAME=$2; FRAMES=$3
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
OUT=$ROOT/renders; SEQ=$OUT/seq_$NAME
mkdir -p "$OUT" "$SEQ"
rm -f "$SEQ"/*.png
start=$(date +%s.%N)
npx remotion render "$ROOT/build" "$ID" "$SEQ" --sequence --image-format=png \
  --scale=0.3333333333333333 --concurrency=1 --log=error 2>&1 | grep -v -i memory || true
end=$(date +%s.%N)
n=$(ls "$SEQ"/*.png | wc -l)
python3 - "$start" "$end" "$n" "$NAME" "$OUT/timings.tsv" <<'PY'
import sys
s, e, n, name, f = float(sys.argv[1]), float(sys.argv[2]), int(sys.argv[3]), sys.argv[4], sys.argv[5]
with open(f, "a") as fh:
    fh.write(f"{name}\t{n}\t{e-s:.1f}\t{(e-s)/n:.3f}\n")
print(f"{name}: {n} frames in {e-s:.1f}s = {(e-s)/n:.3f} s/frame (720p, incl. startup)")
PY
first=$(ls "$SEQ"/*.png | head -1)
pat=$(basename "$first" | sed -E 's/[0-9]+\.png$//')
digits=$(basename "$first" | sed -E 's/^.*-([0-9]+)\.png$/\1/' | tr -d '\n' | wc -c)
ffmpeg -v error -y -framerate 30 -i "$SEQ/${pat}%0${digits}d.png" -c:v libx264 -preset slow -crf 16 \
  -pix_fmt yuv420p -r 30 -an -movflags +faststart "$OUT/$NAME.mp4"
mid=$((FRAMES / 2))
cp "$SEQ/${pat}$(printf "%0${digits}d" $mid).png" "$OUT/${NAME}_full_mid.png"
cp "$SEQ/${pat}$(printf "%0${digits}d" $mid).png" "$OUT/${NAME}_still720.png"
echo "$NAME done"
