#!/usr/bin/env bash
# usage: scripts/still.sh <CompId> <frame> <out.png> [scale]
cd "$(dirname "$0")/.." && npx remotion still src/index.ts "$1" "$3" --frame="$2" --scale="${4:-0.3333333333333333}" --log=error
