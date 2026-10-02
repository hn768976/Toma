#!/usr/bin/env bash
# 1080p preview render that also keeps the lossless frames (for the
# determinism check). Frames come from a normal multi-tab Remotion render;
# the mp4 is encoded from them with Remotion's own ffmpeg and exactly the
# arguments `npx remotion render` uses (libx264, CRF 16, yuv420p, BT.709).
# Usage: scripts/render-preview.sh <CompositionId> [bundleDir]
set -euo pipefail
cd "$(dirname "$0")/.."
C=$1
BUNDLE=${2:-out/bundle}
SEQ=out/seq/$C
rm -rf "$SEQ" && mkdir -p "$SEQ" out/previews
START=$(date +%s)
npx remotion render "$BUNDLE" "$C" "$SEQ" --sequence --image-format=png --scale=0.5 --concurrency=2 --log=info
END=$(date +%s)
N=$(ls "$SEQ" | wc -l)
echo "RENDER_TIME $C frames=$N seconds=$((END-START)) per_frame=$(echo "scale=3; ($END-$START)/$N" | bc)"
npx remotion ffmpeg -y -r 30 -f image2 -i "$SEQ/element-%03d.png" -c:v libx264 \
  -colorspace:v bt709 -color_primaries:v bt709 -color_trc:v bt709 -color_range tv \
  -vf zscale=matrix=709:matrixin=709:range=limited -pix_fmt yuv420p \
  -video_track_timescale 90000 -crf 16 -an -movflags faststart -map_metadata -1 \
  -metadata "comment=Made with Remotion 4.0.515" "out/previews/NeonIcon_$C.mp4"
echo "DONE out/previews/NeonIcon_$C.mp4"
