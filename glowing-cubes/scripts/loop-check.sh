#!/usr/bin/env bash
# Step 2 — loop check for look 1. Makes each Cube Cluster composition 601
# frames long (loopCheck prop), renders frames 0 and 600, and compares them
# pixel for pixel. Runs twice: as delivered, and with the % 600 wrap
# disabled (noWrap) to prove the motion itself closes, not just the modulo.
#
# To bisect a mismatch, pass a toggles object, e.g.
#   PROPS_EXTRA='"toggles":{"turn":true,"slides":false,"pulses":true,"tiny":true,"camera":true,"grain":true}'
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p out/loop
EXTRA="${PROPS_EXTRA:-}"
[ -n "$EXTRA" ] && EXTRA=",$EXTRA"
status=0
for pal in Green Violet Blue; do
  for mode in wrap nowrap; do
    nw=""; [ "$mode" = nowrap ] && nw=',"noWrap":true'
    props="{\"palette\":\"$pal\",\"loopCheck\":true$nw$EXTRA}"
    for f in 0 600; do
      npx remotion still "CubeCluster-$pal" "out/loop/${pal}_${mode}_$f.png" --frame=$f --scale=0.5 --props="$props" > /dev/null 2>&1
    done
    res=$(python3 - "$pal" "$mode" <<'PY'
import sys, numpy as np
from PIL import Image
p, m = sys.argv[1], sys.argv[2]
a = np.asarray(Image.open(f"out/loop/{p}_{m}_0.png")).astype(int)
b = np.asarray(Image.open(f"out/loop/{p}_{m}_600.png")).astype(int)
d = np.abs(a - b)
print(f"{p:6s} {m:6s} max|diff|={d.max()} differing_pixels={(d.sum(axis=2) > 0).sum()}")
PY
)
    echo "$res"
    case "$res" in *"differing_pixels=0"*) ;; *) status=1 ;; esac
  done
done
exit $status
