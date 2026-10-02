#!/usr/bin/env bash
# Loop check: render frames 0 and 600 of a 601-frame variant; they must be
# pixel-identical. Usage: scripts/verify-loop.sh <CompositionId> [bundleDir]
set -euo pipefail
cd "$(dirname "$0")/.."
C=$1; BUNDLE=${2:-out/bundle}; D=out/verify/loop
mkdir -p "$D"
for f in 0 600; do
  npx remotion still "$BUNDLE" "$C" "$D/${C}_f$f.png" --frame=$f --scale=0.5 --props='{"loopCheck":true}' --log=error >/dev/null
done
px() { npx remotion ffmpeg -v error -i "$1" -f image2pipe -c:v rawvideo -pix_fmt rgb24 - | md5sum | cut -c1-32; }
A=$(px "$D/${C}_f0.png"); B=$(px "$D/${C}_f600.png")
if [ "$A" = "$B" ]; then echo "LOOP PASS $C (frame 0 == frame 600, rgb md5 $A)"; else echo "LOOP FAIL $C ($A vs $B)"; exit 1; fi
