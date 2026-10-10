#!/usr/bin/env bash
# Renders the 720p previews: PNG sequence via Remotion at --scale=1/3 (1280x720),
# then H.264 / yuv420p / CRF 16 / 30 fps with ffmpeg. Keeps frame 300 of the full
# render (for the determinism check) and a PNG still of each composition.
#   usage: scripts/render-previews.sh [CompositionId ...]   (default: all 8)
set -euo pipefail
cd "$(dirname "$0")/.."
ALL=(MetaBlobs-NeonBlueMagenta MetaBlobs-WhiteMatte MetaBlobs-SunsetCoral WaveFins-Blue WaveFins-Copper GlowRings-Magenta GlowRings-Violet GlowRings-Teal)
COMPS=("${@:-${ALL[@]}}")
mkdir -p out/previews out/stills out/full300
for c in "${COMPS[@]}"; do
  name="${c/-/_}"
  seq="out/seq/$c"
  rm -rf "$seq"
  start=$(date +%s)
  npx remotion render "$c" "$seq" --sequence --image-format=png --scale=0.3333333333333333 --log=error
  echo "$c: rendered 600 frames in $(( $(date +%s) - start ))s"
  first=$(ls "$seq" | sort | head -1)
  size=$(ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0 "$seq/$first")
  if [ "$size" != "1280,720" ]; then echo "unexpected frame size $size" >&2; exit 1; fi
  pattern=$(ls "$seq" | sort | head -1 | sed -E 's/[0-9]+\.png$//')
  digits=$(ls "$seq" | sort | head -1 | sed -E 's/.*[^0-9]([0-9]+)\.png$/\1/' | tr -d '\n' | wc -c)
  x264extra=()
  # Glow Rings: very dark, very soft gradients -> keep grain through the encoder.
  if [[ "$c" == GlowRings-* ]]; then x264extra=(-tune grain); fi
  ffmpeg -v error -y -framerate 30 -start_number 0 -i "$seq/${pattern}%0${digits}d.png" \
    -c:v libx264 -preset slow -crf 16 "${x264extra[@]}" -pix_fmt yuv420p -r 30 -an \
    -movflags +faststart "out/previews/$name.mp4"
  f300=$(ls "$seq" | sort | sed -n '301p')
  cp "$seq/$f300" "out/full300/$c.png"
  cp "$seq/$f300" "out/stills/$name.png"
  rm -rf "$seq"
done
