#!/usr/bin/env bash
# Verify-loop step 2: render frame 300 on its own from a cold start (fresh
# browser, fresh bundle) and compare it byte for byte with frame 300 of the
# full multi-threaded render made by scripts/render-previews.sh.
# Usage: scripts/verify/determinism.sh <CompositionId> [frame]
set -euo pipefail
cd "$(dirname "$0")/../.."
COMP=$1; FRAME=${2:-300}
GL=${GL:-angle}
FULL=renders/frames/$COMP/element-$(printf %03d "$FRAME").png
COLD=renders/verify/${COMP}_cold_f${FRAME}.png
mkdir -p renders/verify
npx remotion still src/index.ts "$COMP" "$COLD" --frame="$FRAME" --scale=0.5 --gl="$GL" --timeout=300000 >/dev/null 2>&1
if cmp -s "$FULL" "$COLD"; then
  echo "PASS $COMP frame $FRAME byte-identical  sha256 $(sha256sum "$COLD" | cut -c1-16)"
else
  echo "FAIL $COMP frame $FRAME differs: $(sha256sum "$FULL" | cut -c1-16) vs $(sha256sum "$COLD" | cut -c1-16)"
  exit 1
fi
