#!/usr/bin/env bash
# Usage: scripts/bench.sh <CompositionId> <firstFrame> <count> [scale]
# Renders a short PNG sequence and prints seconds per frame (excluding startup).
set -euo pipefail
COMP=$1; FIRST=$2; COUNT=$3; SCALE=${4:-0.5}
GL=${GL:-angle}
BUNDLE=${BUNDLE:-$(mktemp -d)/bundle}
if [ ! -f "$BUNDLE/index.html" ]; then npx remotion bundle --out-dir="$BUNDLE" >/dev/null; fi
OUT=$(mktemp -d)/seq
npx remotion render "$BUNDLE" "$COMP" "$OUT" --sequence --image-format=png \
  --frames="$FIRST-$((FIRST + COUNT - 1))" --scale="$SCALE" --gl="$GL" --concurrency=1 --timeout=300000 ${PROPS:+--props="$PROPS"} 2>&1 | tr "\r" "\n" | grep -iE "error" || true
node -e '
const fs=require("fs"),p=process.argv[1];
const t=fs.readdirSync(p).map(f=>fs.statSync(p+"/"+f).mtimeMs).sort((a,b)=>a-b);
console.log(((t[t.length-1]-t[0])/1000/(t.length-1)).toFixed(2)+" s/frame over "+(t.length-1)+" frames");' "$OUT"
rm -rf "$(dirname "$OUT")"
