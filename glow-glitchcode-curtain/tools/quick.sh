#!/bin/sh
# usage: tools/quick.sh <CompositionId> <frame> <out.png> [scale] [props-json]
# Renders from out/bundle (run tools/bundle.sh after editing src/).
cd "$(dirname "$0")/.." || exit 1
if [ -n "$5" ]; then PROPS="--props=$5"; fi
npx remotion still out/bundle "$1" "$3" --frame="$2" --scale="${4:-0.3333333333333333}" $PROPS 2>&1 | grep -iE "error|fail|exception"; true
