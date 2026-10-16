#!/bin/sh
# usage: ./still.sh <CompId> <frame> <out.png> [scale]
npx remotion still src/index.ts "$1" "$3" --frame="$2" --scale="${4:-0.3333333333333333}" 2>&1 | grep -iE "error|warn|Rendered 1/1" | grep -v memory
