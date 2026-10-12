#!/usr/bin/env bash
# Renders 720p previews (1280x720, H.264, yuv420p, CRF 16, 30fps) + a PNG still
# of frame 150, and records wall-clock time per frame. Usage:
#   tools/render-previews.sh [compositionId...]   (default: all 7)
set -euo pipefail
cd "$(dirname "$0")/.."
B=out/bundle
[ -d "$B" ] || npx remotion bundle src/index.ts --out-dir="$B" >/dev/null
mkdir -p renders
IDS=("$@")
[ ${#IDS[@]} -eq 0 ] && IDS=(PhoneDropIn-GreenScreen PhoneDropIn-PastelGradient PhoneSway-GreenScreen PhoneSway-PastelPink PhoneTumbleLand-GreenScreen PhoneTumbleLand-WhiteStudio PhoneGrid-White)
for id in "${IDS[@]}"; do
  name=${id//-/_}
  t0=$(date +%s.%N)
  npx remotion render "$B" "$id" "renders/$name.mp4" --scale=0.3333333333333333 \
    --codec=h264 --crf=16 --pixel-format=yuv420p --image-format=png --gl=angle \
    --muted --concurrency=4 --log=error >/dev/null
  t1=$(date +%s.%N)
  frames=$(ffprobe -v error -count_frames -select_streams v:0 -show_entries stream=nb_read_frames -of csv=p=0 "renders/$name.mp4")
  echo "$name frames=$frames seconds=$(echo "$t1-$t0" | bc) ms_per_frame=$(echo "($t1-$t0)*1000/$frames" | bc)" | tee -a renders/timings.txt
  npx remotion still "$B" "$id" "renders/$name.png" --frame=150 --scale=0.3333333333333333 --gl=angle --log=error >/dev/null
done
