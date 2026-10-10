#!/bin/bash
# usage: ./dev.sh <frame> <comp> [comp...]  -> out/dev/<comp>_<frame>.png (720p)
F=$1; shift
npx remotion bundle --out-dir=build >/dev/null 2>&1 || { echo bundle failed; exit 1; }
for c in "$@"; do
  npx remotion still build "$c" "out/dev/${c}_$F.png" --frame=$F --scale=0.3333333333333333 2>&1 | grep -iE "error|warn" | head -5
done
