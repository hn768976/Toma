#!/usr/bin/env bash
# Renders a 1280x720 preview of one composition:
#   scripts/render-preview.sh <CompositionId> <OutName> [outDir]
# 1) Remotion renders a lossless PNG sequence at --scale=1/3 (3840x2160 -> 1280x720)
# 2) ffmpeg encodes it: H.264, yuv420p, 30 fps, CRF 16, no audio.
# Environment: GL (default angle; use swangle on GPU-less machines),
#              CHROME (optional browser executable), CONCURRENCY (default 2),
#              BUNDLE (optional pre-built bundle dir), KEEP_FRAMES=1 keeps the PNGs.
set -euo pipefail
comp=$1; name=$2; out=${3:-out}
GL=${GL:-angle}; CONCURRENCY=${CONCURRENCY:-2}
mkdir -p "$out"
frames="$out/frames/$name"
rm -rf "$frames"
args=(--sequence --image-format=png --scale=0.3333333333333333 --gl="$GL" --concurrency="$CONCURRENCY" --timeout=240000)
[ -n "${CHROME:-}" ] && args+=(--browser-executable="$CHROME")
start=$(date +%s)
npx remotion render ${BUNDLE:-src/index.ts} "$comp" "$frames" "${args[@]}"
end=$(date +%s)
n=$(ls "$frames" | wc -l)
echo "$comp: $n frames in $((end - start)) s -> $(echo "scale=3; ($end - $start) / $n" | bc) s/frame" | tee -a "$out/render-times.txt"
first=$(ls "$frames" | head -1)
pattern=$(echo "$first" | sed -E 's/[0-9]+\.png$//')
digits=$(echo "$first" | sed -E 's/.*[^0-9]([0-9]+)\.png$/\1/' | wc -c); digits=$((digits - 1))
ffmpeg -v error -y -framerate 30 -start_number 0 -i "$frames/${pattern}%0${digits}d.png" \
  -c:v libx264 -preset slow -crf 16 -pix_fmt yuv420p -r 30 -an -movflags +faststart "$out/$name.mp4"
# 720p still (STILL_FRAME, default: middle of the clip)
mid=$(printf "%0${digits}d" "${STILL_FRAME:-$(( n / 2 ))}")
cp "$frames/${pattern}${mid}.png" "$out/$name.png"
[ "${KEEP_FRAMES:-0}" = "1" ] || rm -rf "$frames"
