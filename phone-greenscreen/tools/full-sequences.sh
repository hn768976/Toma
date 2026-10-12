#!/usr/bin/env bash
# Full-length PNG-sequence renders (4 threads, frames rendered out of order) for
# the loop check (601-frame loops) and the frame-150 determinism check.
set -euo pipefail
cd "$(dirname "$0")/.."
B=out/bundle
for id in PhoneDropIn-GreenScreen PhoneDropIn-PastelGradient PhoneSway-GreenScreen PhoneSway-PastelPink PhoneTumbleLand-GreenScreen PhoneTumbleLand-WhiteStudio PhoneGrid-White; do
  REMOTION_LOOP_CHECK=1 npx remotion render "$B" "$id" "out/seq/$id" --sequence --image-format=png \
    --scale=0.3333333333333333 --gl=angle --concurrency=4 --log=error >/dev/null
  echo "$id $(ls out/seq/$id | wc -l) frames"
done
