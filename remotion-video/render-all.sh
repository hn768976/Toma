#!/usr/bin/env bash
# Renders both 4K masters. Deliverables are derived from these by `deliver.sh`.
set -euo pipefail
cd "$(dirname "$0")"

# --timeout is generous on purpose: three concurrent tabs each parse the
# three.js WebGPU bundle and then build a ~1M-vertex mesh, which comfortably
# exceeds Remotion's 30 s default on a machine without a GPU.
COMMON=(--codec=h264 --crf=15 --muted --concurrency=3 --timeout=600000 --log=error)

# This machine has no GPU, so the scene falls back to the WebGL 2 backend
# (see src/spiral-flow/backend.ts). swangle is Chromium's software GL.
if [ -x /opt/pw-browsers/chromium-1194/chrome-linux/chrome ]; then
  COMMON+=(--gl=swangle --chrome-mode=chrome-for-testing
           --browser-executable=/opt/pw-browsers/chromium-1194/chrome-linux/chrome)
fi

for VARIANT in Violet Blue; do
  echo "=== rendering SpiralFlow-4K-${VARIANT} ==="
  npx remotion render "SpiralFlow-4K-${VARIANT}" \
    "out/master/SpiralFlow_4K_${VARIANT}.mp4" "${COMMON[@]}"
done
