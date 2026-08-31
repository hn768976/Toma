#!/usr/bin/env bash
# Verifies that a composition loops seamlessly: renders frame 0 and the frame
# exactly one loop later, which must be pixel-identical.
#
# The wrap frame is one past the end of the composition, so the duration is
# temporarily extended by a frame for the probe and restored afterwards.
#
# Usage: scripts/verify-loop.sh <CompositionId> <loopLength>
set -euo pipefail

COMP="$1"
LOOP="$2"
ROOT="src/Root.tsx"
BACKUP="$(mktemp)"

cp "$ROOT" "$BACKUP"
trap 'cp "$BACKUP" "$ROOT"; rm -f "$BACKUP"' EXIT

# Extend every duration by one frame so the wrap frame is renderable.
sed -i 's/\.loopLength}/.loopLength + 1}/g' "$ROOT"

npx remotion still "$COMP" "out/loop-${COMP}-first.png" --frame=0 --scale=0.5 >/dev/null
npx remotion still "$COMP" "out/loop-${COMP}-wrap.png" --frame="$LOOP" --scale=0.5 >/dev/null

FIRST=$(sha256sum "out/loop-${COMP}-first.png" | cut -d' ' -f1)
WRAP=$(sha256sum "out/loop-${COMP}-wrap.png" | cut -d' ' -f1)

if [ "$FIRST" = "$WRAP" ]; then
  echo "PASS  $COMP: frame 0 and frame $LOOP are pixel-identical"
else
  echo "FAIL  $COMP: frame 0 and frame $LOOP differ"
  echo "  frame 0    $FIRST"
  echo "  frame $LOOP  $WRAP"
  exit 1
fi
