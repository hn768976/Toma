#!/usr/bin/env bash
# Renders every composition as a 4K UHD master, then downsamples it to the
# 1080p H.264 deliverable (Lanczos, i.e. 2x2 supersampled anti-aliasing).
#
#   ./scripts/render-all.sh            # all four compositions
#   ./scripts/render-all.sh MoonlitSea-V1-Reference
set -euo pipefail
cd "$(dirname "$0")/.."

COMPS=("$@")
if [ ${#COMPS[@]} -eq 0 ]; then
  COMPS=(
    MoonlitSea-V1-Reference
    MoonlitSea-V2-TealAmber
    ArchiveCorridor-V1-Reference
    ArchiveCorridor-V2-DollyZoomRoll
  )
fi

mkdir -p out/4k out/1080p
for id in "${COMPS[@]}"; do
  echo "==> $id (4K master)"
  npx remotion render "$id" "out/4k/$id-2160p.mp4" --codec=h264 --crf=14
  echo "==> $id (1080p deliverable)"
  ffmpeg -v error -y -i "out/4k/$id-2160p.mp4" \
    -vf "scale=1920:1080:flags=lanczos,format=yuv420p" -r 30 \
    -c:v libx264 -preset slow -crf 16 -profile:v high -level 4.1 \
    -movflags +faststart -an "out/1080p/$id-1080p.mp4"
done
