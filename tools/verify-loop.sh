#!/usr/bin/env bash
# Renders frame 0 and frame 480 of a composition and asserts they are identical.
# durationInFrames is 480, so frame 480 does not exist in the delivered
# composition; it is temporarily widened to 481 purely for this check.
set -euo pipefail
COMP="${1:?composition id}"
cd "$(dirname "$0")/.."
cp src/Root.tsx src/Root.tsx.loopcheck.bak
trap 'mv -f src/Root.tsx.loopcheck.bak src/Root.tsx' EXIT
sed -i 's/durationInFrames={480}/durationInFrames={481}/g' src/Root.tsx
npx remotion still "$COMP" "out/loop-${COMP}-000.png" --frame=0   --scale=0.5 >/dev/null 2>&1
npx remotion still "$COMP" "out/loop-${COMP}-480.png" --frame=480 --scale=0.5 >/dev/null 2>&1
A=$(sha256sum "out/loop-${COMP}-000.png" | cut -d' ' -f1)
B=$(sha256sum "out/loop-${COMP}-480.png" | cut -d' ' -f1)
if [ "$A" = "$B" ]; then
  echo "LOOP OK  $COMP  frame 0 === frame 480  ($A)"
else
  echo "LOOP FAIL $COMP"
  echo "  frame 0   $A"
  echo "  frame 480 $B"
  exit 1
fi
