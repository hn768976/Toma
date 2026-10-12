#!/usr/bin/env bash
# Step 2 (loop) and step 3 (determinism) checks.
#  loop:  with --props loopTest (601 frames), still of frame 0 vs frame 600 → must be pixel-identical
#  det:   cold still of frame 300 vs frame 300 of a multi-threaded sequence render (frames 290-310,
#         concurrency 2, rendered out of order across tabs) → must be byte-identical PNG
set -u
cd "$(dirname "$0")/.."
ids=${*:-"CBDC AI ESG IoT SaaS API ERP CRM KPI LLM"}
mkdir -p out/verify
for id in $ids; do
  d=out/verify/$id; rm -rf "$d"; mkdir -p "$d"
  P='{"loopTest":true}'
  npx remotion still out/bundle "AcronymCubes-$id" "$d/loop_0.png" --frame=0 --props="$P" --scale=0.3333333333333333 >/dev/null 2>&1
  npx remotion still out/bundle "AcronymCubes-$id" "$d/loop_600.png" --frame=600 --props="$P" --scale=0.3333333333333333 >/dev/null 2>&1
  npx remotion still out/bundle "AcronymCubes-$id" "$d/cold_300.png" --frame=300 --scale=0.3333333333333333 >/dev/null 2>&1
  npx remotion render out/bundle "AcronymCubes-$id" "$d/seq" --sequence --image-format=png --frames=290-310 \
    --concurrency=2 --scale=0.3333333333333333 >/dev/null 2>&1
  seq300=$(ls "$d"/seq/*300.png)
  loop=$(cmp -s "$d/loop_0.png" "$d/loop_600.png" && echo PASS || echo FAIL)
  det=$(cmp -s "$d/cold_300.png" "$seq300" && echo PASS || echo FAIL)
  echo "$id loop0==600:$loop cold300==seq300:$det" | tee -a out/verify/results.txt
done
