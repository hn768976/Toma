#!/usr/bin/env bash
# determinism: frame N rendered on its own (cold start) must equal frame N from a running render, byte for byte
# usage: det.sh <project> <composition> <frame>
set -euo pipefail
cd "$1"; C="$2"; N="$3"; A=$((N-6))
rm -rf out/det && mkdir -p out/det
npx remotion render "$C" out/det/seq --sequence --image-format=png --frames=$A-$N --scale=0.5 --gl=angle --concurrency=1 --log=error >/dev/null
npx remotion still "$C" out/det/cold.png --frame=$N --scale=0.5 --gl=angle --log=error >/dev/null
LAST=$(ls out/det/seq/*.png | tail -1)
python3 - "$LAST" out/det/cold.png <<'PY'
import sys, hashlib
from PIL import Image
a=Image.open(sys.argv[1]).convert('RGB').tobytes(); b=Image.open(sys.argv[2]).convert('RGB').tobytes()
print('running-render frame sha256:', hashlib.sha256(a).hexdigest()[:16], ' cold-start sha256:', hashlib.sha256(b).hexdigest()[:16], ' IDENTICAL' if a==b else ' DIFFERENT')
PY
