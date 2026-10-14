#!/usr/bin/env bash
# Quick look: scripts/stills.sh <id> <frame> [frame...] -> out/stills/<id>_<frame>.png (720p)
set -euo pipefail
cd "$(dirname "$0")/.."
id=$1; shift
mkdir -p out/stills
npx remotion bundle src/index.ts --out-dir=out/bundle --log=error >/dev/null
for f in "$@"; do
  npx remotion still out/bundle "$id" "out/stills/${id}_$f.png" --frame="$f" --scale=0.3333333333333333 --gl=angle --log=error >/dev/null &
done
wait
python3 - "$id" "$@" <<'PY'
import sys
from PIL import Image
id, fr = sys.argv[1], sys.argv[2:]
ims = [Image.open(f"out/stills/{id}_{f}.png").resize((640, 360)) for f in fr]
cols = min(len(ims), 3); rows = (len(ims) + cols - 1) // cols
sheet = Image.new("RGB", (640 * cols, 360 * rows))
for i, im in enumerate(ims): sheet.paste(im, ((i % cols) * 640, (i // cols) * 360))
sheet.save(f"out/stills/{id}_sheet.png"); print(f"out/stills/{id}_sheet.png")
PY
