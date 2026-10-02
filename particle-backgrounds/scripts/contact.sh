#!/usr/bin/env bash
# Usage: scripts/contact.sh OUTDIR frame [frame...]  -> one 720p still per composition per frame + a contact sheet
set -euo pipefail
OUT=$1; shift
mkdir -p "$OUT"
IDS=$(node -e "const s=require('fs').readFileSync('src/versions.ts','utf8');console.log([...s.matchAll(/id: \"([^\"]+)\"/g)].map(m=>m[1]).join(' '))")
for id in $IDS; do
  for f in "$@"; do
    npx remotion still "$id" "$OUT/${id}_$f.png" --frame="$f" --scale=0.3333333333333333 --log=error >/dev/null
  done
done
echo "$IDS"
