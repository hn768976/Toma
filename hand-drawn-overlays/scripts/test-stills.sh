#!/usr/bin/env bash
# Usage: scripts/test-stills.sh COMP:FRAME [COMP:FRAME ...]  (renders 720p PNGs into out/test)
set -e
cd "$(dirname "$0")/.."
mkdir -p out/test
for spec in "$@"; do
  comp="${spec%%:*}"; frame="${spec##*:}"
  echo "$comp $frame"
done | xargs -P 4 -n 2 sh -c 'npx remotion still out/bundle "$0" "out/test/$0_$1.png" --frame="$1" --scale=0.3333333333333333 --log=error >/dev/null 2>&1 || echo "FAILED $0 $1"'
