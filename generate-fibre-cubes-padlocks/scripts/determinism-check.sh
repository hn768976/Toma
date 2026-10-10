#!/usr/bin/env bash
# Determinism: frame N rendered on its own from a cold start must match
# frame N rendered inside a multi-threaded range render (out of order,
# several tabs), byte for byte. usage: determinism-check.sh <id> <frame>...
set -e
OUT=${OUT:-out/checks}; mkdir -p "$OUT"
SCALE=${SCALE:-0.3333333333333333}
id=$1; shift
for f in "$@"; do
  lo=$((f>4 ? f-4 : 0)); hi=$((f+4))
  rm -rf "$OUT/seq_${id}_$f"
  npx remotion render "$id" "$OUT/seq_${id}_$f" --sequence --image-format=png --frames=$lo-$hi --concurrency=${CONC:-4} --timeout=600000 --scale=$SCALE --log=error
  npx remotion still "$id" "$OUT/${id}_cold_$f.png" --frame=$f --timeout=600000 --scale=$SCALE --log=error
  seqf=$(ls "$OUT/seq_${id}_$f" | sort | sed -n "$((f-lo+1))p")
  echo -n "$id frame $f cold vs range-render ($seqf): "
  python3 scripts/compare.py "$OUT/${id}_cold_$f.png" "$OUT/seq_${id}_$f/$seqf" || true
done
