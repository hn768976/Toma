#!/bin/bash
# Times one real 4K frame (cold, includes browser start) and a warm 4K frame
# (frames 300-301 in one render, minus the cold single-frame time).
cd "$(dirname "$0")/.."
mkdir -p out/verify/4k
for c in "$@"; do
  s=$(date +%s.%N); npx remotion still out/bundle "$c" "out/verify/4k/$c-300.png" --frame=300 >/dev/null 2>&1; e=$(date +%s.%N)
  one=$(echo "$e-$s" | bc)
  s=$(date +%s.%N); npx remotion render out/bundle "$c" "out/verify/4k/$c-seq" --sequence --image-format=png --frames=300-309 --concurrency=1 >/dev/null 2>&1; e=$(date +%s.%N)
  ten=$(echo "$e-$s" | bc)
  python3 -c "from PIL import Image; print('$c 4K size', Image.open('out/verify/4k/$c-300.png').size)"
  echo "$c 4K: single cold still ${one}s; 10-frame render ${ten}s"
done
