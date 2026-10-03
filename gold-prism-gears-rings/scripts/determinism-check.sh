#!/usr/bin/env bash
# Render frame 300 on its own from a cold start (fresh browser, single frame)
# and compare with frame 300 kept from the full sequence render.
#   scripts/determinism-check.sh <CompositionId> <OutName> [bundleDir]
set -euo pipefail
ID=$1; NAME=$2; BUNDLE=${3:-out/bundle}
mkdir -p out/check
npx remotion still "$BUNDLE" "$ID" "out/check/${NAME}_cold_300.png" --frame=300 \
  --scale=0.3333333333333333 --gl=angle --log=error
python3 scripts/compare.py "out/check/${NAME}_cold_300.png" "out/frames/${NAME}_full_300.png" "FRAME300 $NAME"
cmp -s "out/check/${NAME}_cold_300.png" "out/frames/${NAME}_full_300.png" && echo "FRAME300 $NAME: PNG files byte-identical" || echo "FRAME300 $NAME: PNG files differ at byte level"
