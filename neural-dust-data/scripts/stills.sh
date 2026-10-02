#!/usr/bin/env bash
# usage: scripts/stills.sh <compId> <outPrefix> <frame> [frame...]
# Bundles once (into out/bundle) and renders 720p PNG stills.
set -e
cd "$(dirname "$0")/.."
id=$1; prefix=$2; shift 2
if [ -z "$NOBUNDLE" ]; then npx remotion bundle --out-dir=out/bundle >/dev/null 2>&1; fi
for f in "$@"; do
  npx remotion still out/bundle "$id" "${prefix}_${f}.png" --frame="$f" --scale=0.3333333333333333 --gl=angle --log=error >/dev/null
done
