#!/usr/bin/env bash
# Renders the four 4K compositions and exports them as 1080p H.264 MP4s
# (the 3840x2160 canvas is rendered at full resolution and downscaled with --scale=0.5).
set -euo pipefail
cd "$(dirname "$0")"
OUT="${1:-out}"
mkdir -p "$OUT"
render() {
  npx remotion render "$1" "$OUT/$2" --codec=h264 --pixel-format=yuv420p --color-space=bt709 --image-format=png --crf=16 --scale=0.5 --concurrency="${CONCURRENCY:-2}"
}
render Comp1-StripedFloat-V1     comp1_striped-float_v1_1080p.mp4
render Comp1-StripedFloat-V2     comp1_striped-float_v2_1080p.mp4
render Comp2-WatermelonFloat-V1  comp2_watermelon-float_v1_1080p.mp4
render Comp2-WatermelonFloat-V2  comp2_watermelon-float_v2_1080p.mp4
