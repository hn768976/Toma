#!/usr/bin/env bash
# Render frames 75 and 300 on their own from a cold start and compare them
# byte-for-byte with the same frames from the full PNG-sequence render.
# usage: scripts/check-determinism.sh <compositionId> [gl]
set -euo pipefail
ID=$1; GL=${2:-angle}
SEQ=renders/${ID}_png
TMP=renders/cold_${ID}
mkdir -p "$TMP"
for F in 75 300; do
  npx remotion still "$ID" "$TMP/f$F.png" --frame=$F --scale=0.3333333333333333 --gl="$GL" --log=error
  SEQF=$(printf "%s/element-%03d.png" "$SEQ" $F)
  if cmp -s "$TMP/f$F.png" "$SEQF"; then echo "$ID frame $F: IDENTICAL ($(sha256sum < "$SEQF" | cut -c1-16))";
  else echo "$ID frame $F: DIFFERENT"; fi
done
