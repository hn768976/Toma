#!/usr/bin/env bash
# Renders both 4K masters. Deliverables are derived from these by `deliver.sh`.
set -euo pipefail
cd "$(dirname "$0")"

# --concurrency is deliberately low. Each tab holds a 4K scene pass, its MSAA
# buffers, a bloom mip chain and two blur taps; three at once exhausted the
# software GL driver part-way through a sequence and the device was lost.
#
# --timeout is generous for the opposite reason: each tab parses the three.js
# WebGPU bundle and then builds a ~700k-vertex mesh, which comfortably exceeds
# Remotion's 30 s default on a machine without a GPU.
COMMON=(--codec=h264 --crf=15 --muted --concurrency=2 --timeout=600000 --log=error)

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
