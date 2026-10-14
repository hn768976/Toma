#!/usr/bin/env bash
# Step 3 — the middle frame rendered alone from a cold start must equal the
# same frame from a full, multi-threaded render, byte for byte (decoded pixels
# AND file bytes).
# Needs the full renders as PNG sequences in out/frames/<name>/element-XXX.png
# (scripts/render-frames.sh).
set -uo pipefail
cd "$(dirname "$0")/.."
declare -A MID=( [AIHudPlane-Violet]=225 [AIHudPlane-Teal]=225 [ParticleAIChip-Blue]=300 [AIChipReveal-Blue]=150 [AIChipReveal-Amber]=150 )
mkdir -p out/checks
for id in "${!MID[@]}"; do
  f=${MID[$id]}; name=${id/-/_}
  cold=out/checks/cold_${name}_$f.png
  npx remotion still src/index.ts "$id" "$cold" --frame=$f --scale=0.3333333333333333 --log=error >/dev/null 2>&1
  full=$(printf "out/frames/%s/element-%03d.png" "$name" "$f")
  printf "%-22s frame %3d: " "$name" "$f"
  if cmp -s "$cold" "$full"; then echo -n "file bytes IDENTICAL; "; else echo -n "file bytes differ; "; fi
  python3 scripts/compare-png.py "$cold" "$full"
done
