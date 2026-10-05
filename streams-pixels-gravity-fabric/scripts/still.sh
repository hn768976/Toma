#!/usr/bin/env bash
# usage: scripts/still.sh <CompositionId> <frame> <out.png>   (720p still)
set -euo pipefail
npx remotion still src/index.ts "$1" "$3" --frame="$2" --scale=0.3333333333333333 --gl="${GL:-angle}" --log=error
