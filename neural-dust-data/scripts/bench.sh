#!/usr/bin/env bash
# usage: scripts/bench.sh <compId> <scale> <frames e.g. 100-111>
# Prints wall time for rendering the frame range as PNGs with concurrency 1.
cd "$(dirname "$0")/.."
id=$1; scale=$2; range=$3
rm -rf out/bench/$id
start=$(date +%s.%N)
npx remotion render out/bundle "$id" out/bench/$id --sequence --image-format=png --frames="$range" \
  --scale="$scale" --gl=angle --concurrency=1 --log=error >/dev/null
end=$(date +%s.%N)
echo "$id scale=$scale frames=$range wall=$(echo "$end - $start" | bc)s"
