#!/usr/bin/env bash
# Render one composition as a 720p preview and run the loop + determinism checks.
#   scripts/render-preview.sh <CompositionId> <OutputBaseName> [bundleDir]
# 1. Renders frames 0..600 (601-frame loop-check variant) as PNGs at 1280x720.
# 2. Loop check: frame 0 and frame 600 must have identical decoded pixels.
# 3. Encodes frames 0..599 to H.264 / yuv420p / CRF 16 / 30fps, no audio
#    (scripts/encode-preview.sh).
# 4. Determinism: renders frame 300 alone from a cold start and compares it
#    byte for byte (file and decoded pixels) with frame 300 of the sequence.
set -euo pipefail
COMP="$1"; NAME="$2"; BUNDLE="${3:-out/bundle}"
SCALE=0.3333333333333333
SEQ="out/seq/$COMP"; mkdir -p "$SEQ" out/previews out/stills out/cold out/logs
PROPS="{\"id\":\"$COMP\",\"loopCheck\":true}"
t0=$(date +%s.%N)
[ -n "${SKIP_RENDER:-}" ] || rm -f "$SEQ"/*.png
[ -n "${SKIP_RENDER:-}" ] || npx remotion render "$BUNDLE" "$COMP" "$SEQ" --sequence --image-format=png --props="$PROPS" \
  --scale=$SCALE --concurrency=${CONCURRENCY:-2} --log=error > "out/logs/$COMP.render.log" 2>&1
t1=$(date +%s.%N)
frames=("$SEQ"/element-*.png)   # glob is sorted; no pipes (pipefail + head = SIGPIPE)
n=${#frames[@]}
if [ -n "${SKIP_RENDER:-}" ]; then  # re-run of the checks only: time from the frames' mtimes
  t0=$(stat -c %.9Y "$SEQ"/element-*.png | sort -n | head -n 1 || true); t1=$(stat -c %.9Y "$SEQ"/element-*.png | sort -n | tail -n 1)
fi
perframe=$(echo "($t1 - $t0) / $n" | bc -l)
first=${frames[0]}; last=${frames[$((n - 1))]}
digits=${first##*element-}; digits=${digits%.png}; pad=${#digits}
f300="$SEQ/element-$(printf "%0${pad}d" 300).png"
md5px() { ffmpeg -v error -i "$1" -f framemd5 - | awk -F, '!/^#/ {gsub(/ /, "", $NF); print $NF}'; }
loop="FAIL"; [ "$(md5px "$first")" = "$(md5px "$last")" ] && loop="PASS"
# encode the 600-frame loop
"$(dirname "$0")/encode-preview.sh" "$SEQ" "out/previews/$NAME.mp4"
cp "$f300" "out/stills/$NAME.png"
# cold still of frame 300
npx remotion still "$BUNDLE" "$COMP" "out/cold/$COMP-300.png" --frame=300 --props="{\"id\":\"$COMP\",\"loopCheck\":false}" \
  --scale=$SCALE --image-format=png --log=error > "out/logs/$COMP.still.log" 2>&1
det="FAIL"; cmp -s "$f300" "out/cold/$COMP-300.png" && det="PASS(bytes)"
[ "$det" = "FAIL" ] && [ "$(md5px "$f300")" = "$(md5px "out/cold/$COMP-300.png")" ] && det="PASS(pixels)"
printf "%s\tframes=%d\tsec/frame=%.3f\tloop0v600=%s\tframe300cold=%s\n" "$COMP" "$n" "$perframe" "$loop" "$det" | tee -a out/logs/summary.tsv
