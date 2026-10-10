#!/usr/bin/env bash
# usage: scripts/still.sh <CompositionId> <frame> <out.png> [scale]
set -e
npx remotion still "$1" "$3" --frame="$2" --scale="${4:-0.3333333333333333}" --timeout=600000 --log=error
