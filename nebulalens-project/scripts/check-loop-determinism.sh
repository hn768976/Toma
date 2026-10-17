#!/bin/bash
# Step 2 (loop) and step 3 (determinism) for every composition.
# Step 2: the input prop {"loopCheck":true} makes each composition
#   601 frames; frames 0 and 600 are rendered as PNG and must be identical.
#   Continuity across the wrap: diff(599→600) is compared with diff(298→299).
# Step 3: frame 300 is rendered on its own from a cold start (fresh browser)
#   and compared byte-for-byte with frame 300 of the full multi-threaded render.
cd "$(dirname "$0")/.."
OUT=renders/checks; mkdir -p "$OUT"
[ -d build ] || npx remotion bundle --out-dir=build --log=error
S="--scale=0.3333333333333333 --log=error"
for N in NebulaLens_Pastel Champagne_Gold Champagne_Rose DataMontage_Blue FireCore_Ember FireCore_Electric BarChart_BlueViolet BarChart_TealGreen; do
  ID="${N//_/-}"
  for f in 0 600; do npx remotion still build "$ID" "$OUT/${N}_loop$f.png" --frame=$f --props='{"loopCheck":true}' $S; done
  echo "== $N"
  echo -n "step2 frame0 vs frame600: "; python3 scripts/verify.py same "$OUT/${N}_loop0.png" "$OUT/${N}_loop600.png"
  echo -n "step2 wrap diff 599->600: "; python3 scripts/verify.py diff "renders/seq/$N/element-599.png" "$OUT/${N}_loop600.png"
  echo -n "step2 typical diff 298->299: "; python3 scripts/verify.py diff "renders/seq/$N/element-298.png" "renders/seq/$N/element-299.png"
  npx remotion still build "$ID" "$OUT/${N}_cold300.png" --frame=300 $S
  echo -n "step3 cold 300 vs full-render 300: "; python3 scripts/verify.py same "$OUT/${N}_cold300.png" "renders/seq/$N/element-300.png"
done
