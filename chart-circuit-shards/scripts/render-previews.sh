#!/usr/bin/env bash
# Renders 720p previews: full PNG frame sequence at --scale=1/3 (1280x720),
# then encodes H.264 / yuv420p / 30fps / CRF 16 with ffmpeg (no audio).
# The PNG frames are kept so frame N of the full render can be compared
# byte-for-byte with a cold single-frame render (scripts/verify.py).
#
# usage: scripts/render-previews.sh [bundleDir] [concurrency] [file_id ...]
#        ENCODE_ONLY=1 scripts/render-previews.sh ...   (re-encode existing frames)
set -euo pipefail
cd "$(dirname "$0")/.."
BUNDLE=${1:-build}
CONC=${2:-4}
shift 2 || true
IDS=("$@")
if [ ${#IDS[@]} -eq 0 ]; then
  IDS=(GrowthChart3D_Up GrowthChart3D_Down CircuitFlythrough_Blue NeonShards_Blue NeonShards_Magenta CPUBoard_BlueSilver LaserPanels_CyanPurple LaserPanels_OrangeRed)
fi
[ -d "$BUNDLE" ] || npx remotion bundle src/index.ts --out-dir="$BUNDLE"
mkdir -p out/frames out/stills
for ID in "${IDS[@]}"; do
  COMP=${ID//_/-}
  FR=out/frames/$ID
  # Neon Shards sits on pure black: these x264 options keep its empty areas at
  # black. The other looks keep x264's defaults, whose psy-rd preserves the
  # grain/dither that prevents banding.
  X264=""
  case "$ID" in NeonShards_*) X264="-x264-params psy=0:mbtree=0:no-fast-pskip=1:aq-mode=3" ;; esac
  T0=$(date +%s)
  if [ -z "${ENCODE_ONLY:-}" ]; then
    rm -rf "$FR"
    npx remotion render "$BUNDLE" "$COMP" --sequence --image-format=png \
      --scale=0.3333333333333333 --concurrency="$CONC" --output="$FR" --log=error
  fi
  T1=$(date +%s)
  ffmpeg -v error -y -framerate 30 -start_number 0 -i "$FR/element-%03d.png" \
    -vf "scale=out_color_matrix=bt709:out_range=tv,format=yuv420p" \
    -c:v libx264 -preset slow -crf 16 -pix_fmt yuv420p $X264 \
    -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv \
    -r 30 -an -movflags +faststart "out/$ID.mp4"
  N=$(ls "$FR" | wc -l)
  STILL=$((N / 2))
  cp "$FR/$(printf 'element-%03d.png' $STILL)" "out/stills/$ID.png"
  echo "$ID: $N frames in $((T1 - T0))s (concurrency $CONC) -> out/$ID.mp4"
done
