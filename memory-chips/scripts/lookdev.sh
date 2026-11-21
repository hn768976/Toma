#!/usr/bin/env bash
# Renders the three LookDev stills at 1080p and compares each with its reference frame.
# usage: scripts/lookdev.sh <dir-with-reference-frames> [composition] [extra compare args]
set -euo pipefail
REFDIR="$1"; COMP="${2:-LookDev}"; shift; shift || true
cd "$(dirname "$0")/.."
mkdir -p lookdev/tmp
npx remotion render "$COMP" lookdev/tmp/ld --frames=0-2 --sequence --image-format=png --scale=0.5 --gl=angle --concurrency=1 --log=error
i=0
for m in start middle end; do
  echo "== $m"
  python3 scripts/compare-look.py "$REFDIR/$m.png" "lookdev/tmp/ld/element-$i.png" --out "lookdev/compare-$m.png" --label "$m" $LOOK_ARGS "$@"
  i=$((i+1))
done
