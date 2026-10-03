#!/usr/bin/env bash
# 720p previews of every composition (H.264, yuv420p, CRF 16 from remotion.config.ts).
set -uo pipefail
cd "$(dirname "$0")/.."
mkdir -p out
for NAME in "${@:-TradingTerminal_Bear TradingTerminal_Bull OrderBook_Bear OrderBook_Bull IndicatorsMacro}"; do
  for N in $NAME; do
    ID="${N//_/-}"
    S=$(date +%s.%N)
    npx remotion render "$ID" "out/$N.mp4" --scale=0.3333333333333333 --concurrency=4 > "out/$N.render.log" 2>&1
    RC=$?
    T=$(echo "$(date +%s.%N) - $S" | bc)
    echo "$N exit=$RC wall=${T}s per_frame=$(echo "scale=3; $T/450" | bc)s"
  done
done
