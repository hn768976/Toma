#!/usr/bin/env bash
# Render the five 720p previews (H.264, yuv420p, 30 fps, CRF 16) and one PNG still each.
# Usage: scripts/render-previews.sh [outDir] [compositionId ...]   (default: all five)
set -euo pipefail
cd "$(dirname "$0")/.."
OUT="${1:-renders}"
mkdir -p "$OUT"
SCALE=0.3333333333333333
npx remotion bundle src/index.ts --out-dir=out/bundle >/dev/null
render() { # id file stillFrame
  local id="$1" file="$2" still="$3"
  local t0=$(date +%s.%N)
  npx remotion render out/bundle "$id" "$OUT/$file.mp4" --scale=$SCALE --codec=h264 --crf=16 \
    --pixel-format=yuv420p --image-format=png --gl=angle --concurrency=2 --log=error
  local t1=$(date +%s.%N)
  local n=$(ffprobe -v error -count_frames -select_streams v:0 -show_entries stream=nb_read_frames -of csv=p=0 "$OUT/$file.mp4")
  echo "$id frames=$n wall=$(echo "$t1 - $t0" | bc)s perframe=$(echo "scale=3; ($t1 - $t0) / $n" | bc)s" | tee -a "$OUT/timings.txt"
  npx remotion still out/bundle "$id" "$OUT/$file.png" --frame=$still --scale=$SCALE --gl=angle --log=error
}
shift || true
ALL=(DataWall-Slate CensoredTerminal-Cyan ClassifiedTerminal-Amber ParticleTerrain-BlueEmber ParticleTerrain-Teal)
IDS=("${@:-${ALL[@]}}")
for id in "${IDS[@]}"; do
  case "$id" in
    DataWall-Slate) render DataWall-Slate DataWall_Slate 300 ;;
    CensoredTerminal-Cyan) render CensoredTerminal-Cyan CensoredTerminal_Cyan 400 ;;
    ClassifiedTerminal-Amber) render ClassifiedTerminal-Amber ClassifiedTerminal_Amber 400 ;;
    ParticleTerrain-BlueEmber) render ParticleTerrain-BlueEmber ParticleTerrain_BlueEmber 300 ;;
    ParticleTerrain-Teal) render ParticleTerrain-Teal ParticleTerrain_Teal 300 ;;
    *) echo "unknown composition $id" >&2; exit 1 ;;
  esac
done
