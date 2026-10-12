#!/usr/bin/env bash
# Usage: scripts/stills.sh <outdir> <frame> [ids...]   (720p stills from a fresh bundle)
set -e
cd "$(dirname "$0")/.."
OUT=$1; FRAME=$2; shift 2
mkdir -p "$OUT"
npx remotion bundle src/index.ts --out-dir build-stills --log=error >/dev/null
IDS=${@:-$(node -e "const s=require('fs').readFileSync('src/versions.ts','utf8');console.log([...s.matchAll(/\bid: \"([^\"]+)\"/g)].map(m=>m[1]).join(' '))")}
for id in $IDS; do
  npx remotion still build-stills "$id" "$OUT/${id}_f${FRAME}.png" --frame="$FRAME" --scale=0.3333333333333333 --gl=angle --log=error &
done
wait
