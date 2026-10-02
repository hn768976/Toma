#!/usr/bin/env bash
# All stills from an existing bundle.
set -euo pipefail
cd "$(dirname "$0")/.."
BUNDLE=${1:-out/bundle}
mkdir -p out/stills-6k out/stills-1080p
ALL="AIChat Chatbot AICloud CloudUpload AINetwork ActiveProtection Warning SystemAlert AIChip DataLock"
OTHERS="Chatbot AICloud CloudUpload AINetwork ActiveProtection SystemAlert AIChip DataLock"
for c in $OTHERS; do for f in 0 300; do
  npx remotion still "$BUNDLE" "$c" "out/stills-1080p/NeonIcon_${c}_f${f}.png" --frame=$f --scale=0.5 --log=error >/dev/null
  echo "1080p $c $f"
done; done
for c in $ALL; do
  [ -f "out/stills-6k/NeonIcon_${c}_f0.png" ] || npx remotion still "$BUNDLE" "$c" "out/stills-6k/NeonIcon_${c}_f0.png" --frame=0 --scale=1.5625 --log=error >/dev/null
  echo "6k $c 0"
done
for c in AIChat Warning; do
  npx remotion still "$BUNDLE" "$c" "out/stills-6k/NeonIcon_${c}_f300.png" --frame=300 --scale=1.5625 --log=error >/dev/null
  echo "6k $c 300"
done
echo ALL_STILLS_DONE
