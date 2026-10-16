#!/usr/bin/env bash
# Time real 4K frames: render 1 frame and 5 frames (in one tab); per-frame = (T5 - T1) / 4.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p renders/4k
for id in "$@"; do
  s=$(date +%s.%N); npx remotion render src/index.ts "$id" renders/4k/one --sequence --frames=300-300 --image-format=png --concurrency=1 --log=error; e=$(date +%s.%N)
  t1=$(echo "$e - $s" | bc)
  s=$(date +%s.%N); npx remotion render src/index.ts "$id" renders/4k/five --sequence --frames=300-304 --image-format=png --concurrency=1 --log=error; e=$(date +%s.%N)
  t5=$(echo "$e - $s" | bc)
  echo "$id 4K: 1 frame run ${t1}s, 5 frame run ${t5}s, per frame $(echo "scale=2; ($t5 - $t1) / 4" | bc)s" | tee -a renders/timings-4k.txt
done
python3 -c "from PIL import Image; import glob; print([Image.open(f).size for f in sorted(glob.glob('renders/4k/one/*.png'))])"
