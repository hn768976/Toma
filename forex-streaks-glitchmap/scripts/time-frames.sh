#!/usr/bin/env bash
# Per-frame render cost, separating the fixed start-up cost (bundle, browser, fonts, first-frame caches)
# from the per-frame cost: time a short and a longer frame range with ONE worker and divide the difference.
# usage: scripts/time-frames.sh <CompositionId> <scale> <shortEnd> <longEnd> [propsJson]
#   e.g. scripts/time-frames.sh RateBoard-Red 0.3333333333333333 4 24
#        scripts/time-frames.sh RateBoard-Red 1 0 2            (a real 4K frame)
set -euo pipefail
ID="$1"; SCALE="$2"; A="$3"; B="$4"; PROPS="${5:-{\}}"
run() { # <lastFrame> -> seconds
  local s e; s=$(date +%s.%N)
  npx remotion render "$ID" out/checks/timing-seq --sequence --image-format=png --frames=0-"$1" --scale="$SCALE" \
    --concurrency=1 --props="$PROPS" >/dev/null 2>&1
  e=$(date +%s.%N); rm -rf out/checks/timing-seq; echo "$e - $s" | bc
}
TA=$(run "$A"); TB=$(run "$B")
N=$((B - A))
python3 -I - "$ID" "$SCALE" "$TA" "$TB" "$N" "$A" "$B" <<'PY'
import sys
i, sc, ta, tb, n, a, b = sys.argv[1:8]
ta, tb, n = float(ta), float(tb), int(n)
print(f"{i} scale={sc}: frames 0-{a}: {ta:.1f}s, frames 0-{b}: {tb:.1f}s -> {1000*(tb-ta)/n:.0f} ms per frame (1 worker), fixed start-up ~{ta - (int(a)+1)*(tb-ta)/n:.1f}s")
PY
