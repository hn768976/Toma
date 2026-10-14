#!/usr/bin/env bash
# Step 2 (loop) and step 3 (determinism) for one composition.
#   scripts/verify/loop-determinism.sh <CompositionId> <OutputBaseName>
# Needs build/bundle (same source as the preview render) and the kept PNGs
# from scripts/render-preview.sh (renders/keep/<name>_f300.png etc).
set -euo pipefail
ID="$1"; NAME="$2"; D=renders/verify/ld; mkdir -p "$D"
S=0.3333333333333333
# Step 2: composition temporarily 601 frames; frame 0 vs frame 600
npx remotion still build/bundle "$ID" "$D/${NAME}_l000.png" --frame=0   --scale=$S --props='{"durationOverride":601}' --log=error >/dev/null
npx remotion still build/bundle "$ID" "$D/${NAME}_l600.png" --frame=600 --scale=$S --props='{"durationOverride":601}' --log=error >/dev/null
if cmp -s "$D/${NAME}_l000.png" "$D/${NAME}_l600.png"; then loop=IDENTICAL; else loop=DIFFERENT; fi
# Step 3: frame 300 alone, cold start, vs frame 300 of the full render
npx remotion still build/bundle "$ID" "$D/${NAME}_cold300.png" --frame=300 --scale=$S --log=error >/dev/null
if cmp -s "$D/${NAME}_cold300.png" "renders/keep/${NAME}_f300.png"; then det=BYTE-IDENTICAL; else det=DIFFERENT; fi
# seam continuity: mean abs diff 599->0 (the seam) vs 299->300 (normal step)
cont=$(python3 - "$NAME" <<'PY'
import sys, numpy as np
from PIL import Image
n=sys.argv[1]; k=lambda f: np.asarray(Image.open(f"renders/keep/{n}_f{f:03d}.png").convert("RGB")).astype(float)
seam=np.abs(k(599)-k(0)).mean(); norm=np.abs(k(300)-k(299)).mean(); norm2=np.abs(k(301)-k(300)).mean()
print(f"seam(599->0)={seam:.2f} normal(299->300)={norm:.2f} normal(300->301)={norm2:.2f}")
PY
)
echo "$ID loop0==600:$loop  cold300:$det  $cont" | tee -a renders/verify/loop-determinism.txt
