#!/usr/bin/env bash
# Step 3: render each composition in full as a PNG sequence (4 tabs, out of order), then
# render its middle frame on its own from a cold start; the two must match byte for byte.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p out/checks
npx remotion bundle src/index.ts --out-dir=out/bundle --log=error >/dev/null
for id in "$@"; do
  dur=$(npx remotion compositions out/bundle --log=error 2>/dev/null | awk -v id="$id" '$1==id {print $4}')
  mid=$((dur / 2))
  rm -rf "out/checks/seq_$id"
  npx remotion render out/bundle "$id" "out/checks/seq_$id" --sequence --image-format=png --concurrency=4 \
    --scale=0.3333333333333333 --gl=angle --log=error >/dev/null
  npx remotion still out/bundle "$id" "out/checks/cold_${id}_$mid.png" --frame=$mid \
    --scale=0.3333333333333333 --gl=angle --log=error >/dev/null
  seqf=$(ls out/checks/seq_$id/ | sort | sed -n "$((mid + 1))p")
  python3 -I scripts/verify.py png-equal "out/checks/cold_${id}_$mid.png" "out/checks/seq_$id/$seqf" || true
  # keep only the middle frame of the sequence
  find "out/checks/seq_$id" -type f ! -name "$seqf" -delete
done
