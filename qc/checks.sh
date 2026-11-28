#!/bin/bash
# Loop and determinism checks for one composition (step 8A, items 5 and 6).
# usage: checks.sh <project> <compositionId> <variant v1|v2> <loopFrames> <middleFrame> [browser-executable]
set -e
P=$1; COMP=$2; VAR=$3; N=$4; MID=$5; BR=${6:+--browser-executable=$6}
ROOT=$(cd "$(dirname "$0")/.." && pwd)
OUT=$ROOT/qc/results/$COMP
rm -rf "$OUT" && mkdir -p "$OUT"
cd "$ROOT/$P"
COMMON="--image-format=png --scale=0.5 --gl=angle --concurrency=1 --log=error $BR"
# 5. loop: frame N (the frame after the last) against frame 0
npx remotion render LoopCheck "$OUT/loop" --sequence --props="{\"variant\":\"$VAR\",\"loopFrames\":$N}" $COMMON > "$OUT/loop.log" 2>&1
# 6. determinism: the middle frame rendered cold on its own, against the same frame inside a sequential run
npx remotion still $COMP "$OUT/cold-$MID.png" --frame=$MID $COMMON > "$OUT/cold.log" 2>&1
npx remotion render $COMP "$OUT/seq" --sequence --frames=$((MID-4))-$((MID+1)) $COMMON > "$OUT/seq.log" 2>&1
python3 - "$OUT" "$MID" <<'PY'
import sys, glob, hashlib, json, numpy as np
from PIL import Image
out, mid = sys.argv[1], int(sys.argv[2])
def px(p): return np.asarray(Image.open(p).convert("RGB")).astype(np.int16)
def md5(p): return hashlib.md5(open(p, "rb").read()).hexdigest()
loop = sorted(glob.glob(out + "/loop/*.png"))
a, b = px(loop[0]), px(loop[1])
res = {"loop_max_abs_diff": int(np.abs(a - b).max()), "loop_differing_pixels": int((np.abs(a - b).sum(-1) > 0).sum()),
       "loop_md5": [md5(loop[0]), md5(loop[1])]}
seq = [f for f in glob.glob(out + "/seq/*.png") if f.rsplit("-", 1)[1].split(".")[0].lstrip("0") in (str(mid),)][0]
cold = out + f"/cold-{mid}.png"
c, s = px(cold), px(seq)
res.update({"determinism_cold_md5": md5(cold), "determinism_sequence_md5": md5(seq),
            "determinism_bytes_identical": md5(cold) == md5(seq), "determinism_max_abs_diff": int(np.abs(c - s).max())})
res["pass_loop"] = res["loop_differing_pixels"] == 0
res["pass_determinism"] = res["determinism_bytes_identical"]
json.dump(res, open(out + "/checks.json", "w"), indent=1)
print(json.dumps(res, indent=1))
PY
