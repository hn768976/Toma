#!/usr/bin/env bash
# Full multi-threaded render of each composition as a 720p PNG sequence
# (used by the determinism check; the mp4 previews are rendered separately).
set -euo pipefail
cd "$(dirname "$0")/.."
IDS=${*:-"AIHudPlane-Violet AIHudPlane-Teal ParticleAIChip-Blue AIChipReveal-Blue AIChipReveal-Amber"}
for id in $IDS; do
  name=${id/-/_}
  npx remotion render out/bundle "$id" "out/frames/$name" --sequence --image-format=png \
    --scale=0.3333333333333333 --concurrency=4 --log=error
done
