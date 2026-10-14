#!/usr/bin/env bash
# Render the 720p previews of all 7 compositions and log the time of each.
#   scripts/render-previews.sh [outdir] [id ...]
set -uo pipefail
out=${1:-out/previews}; shift || true
ids=("$@")
[ ${#ids[@]} -eq 0 ] && ids=(CellDivision-Red CellDivision-Blue CellField-Blue CellField-Red HeroCell-Blue SpiralBands-White SpiralBands-Graphite)
mkdir -p "$out"
bundle=$(mktemp -d)/bundle
npx remotion bundle --out-dir "$bundle" >/dev/null 2>&1
for id in "${ids[@]}"; do
  name=${id/-/_}
  t0=$(date +%s)
  npx remotion render "$bundle" "$id" "$out/$name.mp4" --scale=0.3333333333333333 --gl=angle --concurrency=${CONCURRENCY:-2} --log=error > "$out/$name.log" 2>&1
  code=$?
  t1=$(date +%s)
  frames=$(ffprobe -v error -count_frames -select_streams v:0 -show_entries stream=nb_read_frames -of csv=p=0 "$out/$name.mp4" 2>/dev/null)
  echo "$id exit=$code seconds=$((t1-t0)) frames=$frames" | tee -a "$out/timings.txt"
done
