#!/usr/bin/env bash
# Render the 720p previews (scale 1/3 of 3840x2160) and a 720p PNG still of
# each composition, logging wall-clock render time per frame.
# Usage: scripts/render-previews.sh [CompId ...]
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=out/previews
mkdir -p "$OUT"
B=${BUNDLE:-build}
[ -d "$B" ] || npx remotion bundle --out-dir "$B" >/dev/null
COMPS=("$@")
if [ ${#COMPS[@]} -eq 0 ]; then
  COMPS=(CapsuleRelease-White CapsuleRelease-TwoTone DNAParticles-Violet DNAForm-Teal DNAParticles-Teal WaterDrop-Blue RadialBurst-Navy RadialBurst-TealGold)
fi
for c in "${COMPS[@]}"; do
  name=${c/-/_}
  start=$(date +%s.%N)
  npx remotion render "$B" "$c" "$OUT/$name.mp4" --scale=0.3333333333333333 --codec=h264 --crf=16 --pixel-format=yuv420p --image-format=png --gl=angle --muted >/dev/null
  end=$(date +%s.%N)
  frames=$(ffprobe -v error -count_frames -select_streams v:0 -show_entries stream=nb_read_frames -of csv=p=0 "$OUT/$name.mp4")
  echo "$name frames=$frames total_s=$(echo "$end-$start" | bc) s_per_frame=$(echo "scale=3;($end-$start)/$frames" | bc)" | tee -a "$OUT/timings.txt"
  mid=$((frames/2))
  npx remotion still "$B" "$c" "$OUT/$name.png" --frame=$mid --scale=0.3333333333333333 --gl=angle >/dev/null
done
