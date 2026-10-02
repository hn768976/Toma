#!/usr/bin/env bash
# Step 4: frame 150 rendered alone from a cold start must equal frame 150 of a
# full, multi-threaded, out-of-order render, byte for byte.
#   bash scripts/check-determinism.sh AttackGlitch-RANSOMWARE [frames...]
# Extra frames (default: just 150) are checked the same way.
set -euo pipefail
ID="$1"; shift
FRAMES="${*:-150}"
OUT="out/determinism/$ID"
rm -rf "$OUT" && mkdir -p "$OUT/seq"

echo "1) clock-driven animation in src/ (must be empty):"
grep -rnE "@keyframes|transition:|animation:|Math\.random\(|Date\.now\(|requestAnimationFrame|useState|useEffect" src \
  | grep -vE "^\S+:\s*//|// " || echo "   none"

echo "2) full render as a PNG sequence (all frames, $(nproc) threads)"
npx remotion render "$ID" "$OUT/seq" --sequence --image-format=png --scale=0.5 \
  --concurrency="$(nproc)" --log=error

FAIL=0
for F in $FRAMES; do
  echo "3) cold-start still of frame $F (fresh bundle, fresh browser)"
  npx remotion still "$ID" "$OUT/cold_f$F.png" --frame="$F" --scale=0.5 --image-format=png --log=error
  SEQ=$(ls "$OUT"/seq/*-$(printf "%03d" "$F").png)
  if cmp -s "$SEQ" "$OUT/cold_f$F.png"; then
    echo "   frame $F IDENTICAL: sha256 $(sha256sum "$OUT/cold_f$F.png" | cut -c1-16) == $(sha256sum "$SEQ" | cut -c1-16)"
  else
    echo "   frame $F DIFFERENT"; FAIL=1
  fi
done
exit $FAIL
