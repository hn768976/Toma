#!/bin/bash
# usage: tools/verify.sh <CompositionId> <OutputName>
# Renders the 720p preview and runs the mechanical checks (steps 1-6 of the
# verify loop). Needs out/bundle (tools/bundle.sh). Results land in out/verify/<id>/.

cd "$(dirname "$0")/.."
ID="$1"; NAME="$2"; SCALE=0.3333333333333333
V=out/verify/$ID; P=out/previews
mkdir -p "$V" "$P"
R="npx remotion"

echo "== render mp4"
T0=$(date +%s); $R render out/bundle "$ID" "$P/$NAME.mp4" --scale=$SCALE --codec=h264 --crf=16 --pixel-format=yuv420p --muted --concurrency=4 2>&1 | grep -E "rror"; echo "mp4 render wall: $(( $(date +%s) - T0 )) s (4 tabs)"

echo "== step 1: ffprobe"
ffprobe -v error -show_entries stream=codec_type,codec_name,width,height,r_frame_rate,pix_fmt -show_entries format=duration -of default=noprint_wrappers=1 "$P/$NAME.mp4"

echo "== step 2: loop (frame 0 vs 600)"
$R still out/bundle "$ID" "$V/loop0.png"   --frame=0   --scale=$SCALE --props='{"frames":601}' 2>&1 | grep -iE "error" || true
$R still out/bundle "$ID" "$V/loop600.png" --frame=600 --scale=$SCALE --props='{"frames":601}' 2>&1 | grep -iE "error" || true
python3 tools/cmp.py "$V/loop0.png" "$V/loop600.png" "loop 0==600"

echo "== step 3: cold start vs full render (frame sequence, 4 threads)"
rm -rf "$V/seq"
$R render out/bundle "$ID" "$V/seq" --sequence --image-format=png --scale=$SCALE --concurrency=4 2>&1 | grep -iE "error" || true
for F in ${HEAVY:-300 260}; do
  $R still out/bundle "$ID" "$V/cold$F.png" --frame=$F --scale=$SCALE 2>&1 | grep -iE "error" || true
  python3 tools/cmp.py "$V/cold$F.png" "$(ls $V/seq/*.png | sed -n "$((F+1))p")" "cold frame $F == full render"
done
