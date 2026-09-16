#!/usr/bin/env bash
# Verifies a rendered 4K PNG sequence before it is encoded.
#
# A plain per-frame luma scan is not enough. It catches a frame that went black
# or white, but not a frame that is a near-copy of some *other* valid frame --
# which is exactly what a driver that silently re-screenshots a stale canvas
# produces, and what slipped through once already.
#
# So this checks three things:
#   1. frame count and per-frame brightness sanity
#   2. no step between neighbouring frames is an outlier against the median,
#      which is what a misplaced frame looks like: a spike either side of it
#   3. the loop actually closes -- the 179 -> 0 step is in family with the rest
#
#   ./verify.sh <sequence-dir>
set -euo pipefail
cd "$(dirname "$0")"

DIR="${1:?sequence dir required}"
EXPECTED=180
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

COUNT=$(find "$DIR" -name 'frame_*.png' | wc -l)
if [ "$COUNT" -ne "$EXPECTED" ]; then
  echo "FAIL: ${COUNT} frames, expected ${EXPECTED}"
  exit 1
fi
echo "frames: ${COUNT}"

# Per-frame brightness. Anything near black or blown out is a dead canvas.
ffmpeg -v error -framerate 30 -i "$DIR/frame_%04d.png" \
  -vf "scale=240:135,signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=-" \
  -f null - 2>&1 | grep YAVG | awk -F= '{printf "%d %.4f\n", NR-1, $2}' > "$WORK/luma"

awk '{ if ($2 < 40 || $2 > 215) { printf "FAIL: frame %d luma %.2f\n", $1, $2; bad=1 } }
     END { exit bad }' "$WORK/luma" || exit 1
awk '{ if (mn == "" || $2 < mn) mn = $2; if ($2 > mx) mx = $2 }
     END { printf "luma range: %.2f .. %.2f\n", mn, mx }' "$WORK/luma"

# Step between neighbouring frames. The loop closes, so the wrap is appended as
# just another step and held to the same standard.
ffmpeg -v error -framerate 30 -i "$DIR/frame_%04d.png" \
  -vf "scale=240:135,tblend=all_mode=difference,format=gray,signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=-" \
  -f null - 2>&1 | grep YAVG | awk -F= '{printf "%d %.5f\n", NR, $2}' > "$WORK/steps"

WRAP=$(ffmpeg -v error -i "$DIR/frame_0179.png" -i "$DIR/frame_0000.png" \
  -filter_complex "[0:v]scale=240:135[a];[1:v]scale=240:135[b];[a][b]blend=all_mode=difference,format=gray,signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=-" \
  -f null - 2>&1 | grep -o 'YAVG=[0-9.]*' | cut -d= -f2)
echo "180 $WRAP" >> "$WORK/steps"

MEDIAN=$(awk '{print $2}' "$WORK/steps" | sort -g | awk '{a[NR]=$1} END {print a[int(NR/2)+1]}')
echo "median step: ${MEDIAN}   wrap step: ${WRAP}"

# A misplaced frame shows as a step several times the median. Real motion here
# varies smoothly, so 4x is far outside anything legitimate.
awk -v med="$MEDIAN" '
  $2 > med * 4 { printf "FAIL: step into frame %s is %.4f, %.1fx the median\n", $1, $2, $2/med; bad=1 }
  $2 < med / 8 { printf "FAIL: step into frame %s is %.5f, suspiciously close to a duplicate\n", $1, $2; bad=1 }
  END { exit bad }' "$WORK/steps" || exit 1

echo "PASS: ${DIR}"
