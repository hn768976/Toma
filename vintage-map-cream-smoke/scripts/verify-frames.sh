#!/usr/bin/env bash
# Loop and determinism checks (README "Verification").
#  - every composition: frame 300 rendered alone from a cold start must equal
#    frame 300 of the full render (out/frame300, from render-previews.sh)
#  - looping compositions: with --props '{"loopCheck":true}' (601 frames),
#    frame 600 must equal frame 0; frame 599 -> 0 must change about as much
#    as 0 -> 1 (no jump at the seam)
set -euo pipefail
cd "$(dirname "$0")/.."
GL="${GL:-angle}"
OUT="${OUT:-out}"
V="$OUT/verify"
mkdir -p "$V"
S="--scale=0.3333333333333333 --gl=$GL"
ALL=(VintageMap-Europe VintageMap-NorthAmerica VintageMap-World CreamSwirl-Cream CreamSwirl-Blush CreamSwirl-Caramel ParticleSmoke-Blue ParticleSmoke-Gold)
IDS=("$@")
[ ${#IDS[@]} -eq 0 ] && IDS=("${ALL[@]}")
for id in "${IDS[@]}"; do
  name="${id/-/_}"
  npx remotion still "$id" "$V/${name}_cold300.png" --frame=300 $S > /dev/null 2>&1
  if cmp -s "$V/${name}_cold300.png" "$OUT/frame300/$name.png"; then echo "$id determinism: PASS (byte-identical)"; else echo "$id determinism: FAIL"; fi
  case "$id" in
    VintageMap-*) ;;
    *)
      for f in 0 1 599 600; do
        npx remotion still "$id" "$V/${name}_loop$f.png" --frame=$f --props='{"loopCheck":true}' $S > /dev/null 2>&1
      done
      if cmp -s "$V/${name}_loop0.png" "$V/${name}_loop600.png"; then echo "$id loop 0==600: PASS (byte-identical)"; else echo "$id loop 0==600: FAIL"; fi
      python3 - "$V/${name}_loop599.png" "$V/${name}_loop0.png" "$V/${name}_loop1.png" "$id" <<'PY'
import sys
import numpy as np
from PIL import Image
a, b, c = (np.asarray(Image.open(p).convert("RGB")).astype(float) for p in sys.argv[1:4])
seam = np.abs(a - b).mean(); step = np.abs(b - c).mean()
print(f"{sys.argv[4]} seam 599->0 mean abs diff {seam:.3f} vs 0->1 {step:.3f}: {'PASS' if seam < step * 1.5 + 0.3 else 'FAIL'}")
PY
      ;;
  esac
done
