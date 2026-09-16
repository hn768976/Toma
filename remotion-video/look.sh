#!/usr/bin/env bash
# Look-development helper: renders a small still (or a few) so scene tweaks can
# be judged in seconds instead of minutes. Not part of the delivery pipeline.
#   ./look.sh <name> [frame] [grade] [scale]
set -euo pipefail
NAME="${1:-look}"
FRAME="${2:-0}"
GRADE="${3:-violet}"
SCALE="${4:-0.4}"
cd "$(dirname "$0")"
mkdir -p out/test
npx remotion still SpiralFlow-1080-Violet "out/test/${NAME}.png" \
  --frame="${FRAME}" --scale="${SCALE}" --gl=swangle \
  --chrome-mode=chrome-for-testing \
  --browser-executable=/opt/pw-browsers/chromium-1194/chrome-linux/chrome \
  --props="{\"grade\":\"${GRADE}\",\"meshDetail\":1,\"samples\":4,\"forceWebGL\":true}" \
  --log=error
echo "out/test/${NAME}.png"
