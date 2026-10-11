#!/usr/bin/env bash
# Step 2: frame 0 vs frame 600 (601-frame composition) must be pixel-identical.
# Step 3: frame 300 rendered alone (cold start) vs frame 300 from a multi-frame,
#         multi-threaded render must be byte-identical.
set -euo pipefail
cd "$(dirname "$0")/.."
B=out/bundle; D=out/checks
mkdir -p "$D"
[ -d "$B" ] || npx remotion bundle src/index.ts --out-dir="$B" >/dev/null
IDS=("$@")
[ ${#IDS[@]} -eq 0 ] && IDS=(WindFarmHologram-Blue WindFarmHologram-Green PrismDispersion-Dark MagneticTorus-PinkViolet BarMagnets-Attract BarMagnets-Repel ElectricField-OppositeCharges ElectricField-LikeCharges)
SC="--scale=0.3333333333333333 --timeout=180000"
for id in "${IDS[@]}"; do
  P="{\"variant\":\"$id\",\"loopCheck\":true}"
  npx remotion still "$B" "$id" "$D/${id}_f0.png" --frame=0 $SC --props="$P" >/dev/null
  npx remotion still "$B" "$id" "$D/${id}_f600.png" --frame=600 $SC --props="$P" >/dev/null
  npx remotion still "$B" "$id" "$D/${id}_cold300.png" --frame=300 $SC >/dev/null
  rm -rf "$D/${id}_seq"
  npx remotion render "$B" "$id" "$D/${id}_seq" --sequence --image-format=png --frames=296-304 --concurrency=2 $SC >/dev/null
  python3 - "$D" "$id" <<'PY'
import sys, glob
from PIL import Image, ImageChops
d, i = sys.argv[1], sys.argv[2]
def same(a, b):
    A, B = Image.open(a).convert("RGB"), Image.open(b).convert("RGB")
    diff = ImageChops.difference(A, B)
    return A.tobytes() == B.tobytes(), diff.getbbox(), max(diff.getextrema(), key=lambda e: e[1])[1]
seq = sorted(glob.glob(f"{d}/{i}_seq/*300*.png")) or sorted(glob.glob(f"{d}/{i}_seq/*.png"))[4:5]
l = same(f"{d}/{i}_f0.png", f"{d}/{i}_f600.png")
c = same(f"{d}/{i}_cold300.png", seq[0])
import hashlib
h = lambda p: hashlib.sha256(open(p, "rb").read()).hexdigest()[:12]
print(f"{i}: sha cold300={h(f'{d}/{i}_cold300.png')} seq300={h(seq[0])}")
print(f"{i}: loop0vs600 identical={l[0]} maxdiff={l[2]} | cold300 vs seq300 ({seq[0].split('/')[-1]}) identical={c[0]} maxdiff={c[2]}")
PY
done
