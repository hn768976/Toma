#!/usr/bin/env bash
# Determinism check: frame 300 rendered alone from a cold start must equal
# frame 300 from the full multi-tab render (out/seq/<C>/element-300.png),
# byte for byte. Usage: scripts/verify-determinism.sh <CompositionId> [bundleDir]
set -euo pipefail
cd "$(dirname "$0")/.."
C=$1; BUNDLE=${2:-out/bundle}; D=out/verify/determinism
FULL=out/seq/$C/element-300.png
mkdir -p "$D"
npx remotion still "$BUNDLE" "$C" "$D/${C}_cold_f300.png" --frame=300 --scale=0.5 --log=error >/dev/null
px() { npx remotion ffmpeg -v error -i "$1" -f image2pipe -c:v rawvideo -pix_fmt rgb24 - | md5sum | cut -c1-32; }
FB=$(md5sum < "$FULL" | cut -c1-32); CB=$(md5sum < "$D/${C}_cold_f300.png" | cut -c1-32)
FP=$(px "$FULL"); CP=$(px "$D/${C}_cold_f300.png")
echo "file bytes : full=$FB cold=$CB $( [ "$FB" = "$CB" ] && echo IDENTICAL || echo DIFFERENT)"
echo "pixel data : full=$FP cold=$CP $( [ "$FP" = "$CP" ] && echo IDENTICAL || echo DIFFERENT)"
if cmp -s "$FULL" "$D/${C}_cold_f300.png"; then echo "DETERMINISM PASS $C"; else echo "DETERMINISM FAIL $C"; exit 1; fi
