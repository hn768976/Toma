#!/bin/bash
# Renders frames 45, 225 and 449 of both versions (1080p PNG) into out/chk and,
# if a reference-frame directory is given (files f45.png f225.png f449.png),
# prints the look comparison for Version 1.
# Usage: scripts/check-stills.sh [reference frame dir]
set -e
cd "$(dirname "$0")/.."
mkdir -p out/chk
for v in V1 V2; do
  for f in 45 225 449; do
    npx remotion still $v-city-growth out/chk/$v-$f.png --frame=$f --scale=0.5 --gl=angle --log=error
  done
done
if [ -n "${1:-}" ]; then
  for f in 45 225 449; do
    python3 scripts/measure-look.py "$1/f$f.png" out/chk/V1-$f.png --mask 285,170,480,260 --quiet | sed "s/^/V1 f$f /"
  done
fi
