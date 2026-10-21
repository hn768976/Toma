#!/bin/bash
# Determinism self-check: renders frames [mid-20, mid] in one continuous browser session
# (the "full render" path, after earlier frames have been drawn), then renders frame `mid`
# as a cold-start still in a fresh browser, and compares the decoded pixels byte for byte.
# usage: scripts/determinism.sh <Composition-Id> <midFrame>
cd "$(dirname "$0")/.."
id=$1; mid=$2
BROWSER_ARG=""
[ -n "$BROWSER" ] && BROWSER_ARG="--browser-executable=$BROWSER"
dir=out/determinism/$id; rm -rf "$dir"; mkdir -p "$dir/seq"
npx remotion render src/index.ts "$id" "$dir/seq" --sequence --image-format=png --frames=$((mid-20))-$mid \
  --concurrency=1 --scale=0.3333333333333333 --gl=angle $BROWSER_ARG --log=error >/dev/null 2>&1
npx remotion still src/index.ts "$id" "$dir/cold.png" --frame=$mid \
  --scale=0.3333333333333333 --gl=angle $BROWSER_ARG --log=error >/dev/null 2>&1
seqfile=$(ls "$dir"/seq/*.png | sort | tail -1)
a=$(ffmpeg -v error -i "$seqfile" -f rawvideo -pix_fmt rgb24 - | sha256sum | cut -c1-16)
b=$(ffmpeg -v error -i "$dir/cold.png" -f rawvideo -pix_fmt rgb24 - | sha256sum | cut -c1-16)
if [ "$a" == "$b" ]; then echo "$id frame $mid: IDENTICAL ($a)"; else echo "$id frame $mid: DIFFERENT ($a vs $b)"; fi
