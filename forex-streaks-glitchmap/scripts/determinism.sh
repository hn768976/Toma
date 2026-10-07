#!/usr/bin/env bash
# Step 3: a frame rendered on its own from a cold start must match, byte for
# byte, the same frame from a multi-threaded sequence render.
# usage: scripts/determinism.sh <CompositionId> <frame> [window] [scale]
#   window: half-width of the sequence render around <frame> (default 3 frames)
set -euo pipefail
ID="$1"; FRAME="$2"; WIN="${3:-3}"; SCALE="${4:-0.3333333333333333}"
OUT="${OUT_DIR:-out/checks}"; mkdir -p "$OUT"; SEQ="$OUT/$ID.seq"; rm -rf "$SEQ"
LO=$((FRAME-WIN)); [ $LO -lt 0 ] && LO=0; HI=$((FRAME+WIN))
npx remotion still "$ID" "$OUT/$ID.cold$FRAME.png" --frame=$FRAME --scale="$SCALE" >/dev/null 2>&1
npx remotion render "$ID" "$SEQ" --sequence --image-format=png --frames=$LO-$HI --scale="$SCALE" \
  --concurrency="${CONCURRENCY:-3}" >/dev/null 2>&1
N=$(printf "%04d" "$FRAME")
SEQFILE=$(ls "$SEQ" | grep -E "element-0*$FRAME\.png|$FRAME\.png" | head -1)
if cmp -s "$OUT/$ID.cold$FRAME.png" "$SEQ/$SEQFILE"; then
  echo "DETERMINISTIC OK   $ID frame $FRAME: cold still == frame from sequence render (byte-identical)"
else
  echo "DETERMINISTIC FAIL $ID frame $FRAME"; exit 1
fi
