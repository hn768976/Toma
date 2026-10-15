#!/usr/bin/env bash
# Step 3: render the middle frame on its own from a cold start (remotion still)
# and compare it with the same frame taken from a multi-threaded, out-of-order
# sequence render (frames mid-6..mid+6, PNG, concurrency 4).
cd "$(dirname "$0")/.."
B=${BUNDLE:-build}
mkdir -p out/detcheck
COMPS=("$@")
[ ${#COMPS[@]} -eq 0 ] && COMPS=(CapsuleRelease-White CapsuleRelease-TwoTone DNAParticles-Violet DNAForm-Teal DNAParticles-Teal WaterDrop-Blue RadialBurst-Navy RadialBurst-TealGold)
for c in "${COMPS[@]}"; do
  case $c in CapsuleRelease*|DNAForm*) mid=180;; *) mid=300;; esac
  rm -rf "out/detcheck/$c"; mkdir -p "out/detcheck/$c"
  npx remotion render "$B" "$c" "out/detcheck/$c/seq" --sequence --image-format=png --frames=$((mid-6))-$((mid+6)) --concurrency=4 --scale=0.3333333333333333 --gl=angle >/dev/null 2>&1
  npx remotion still "$B" "$c" "out/detcheck/$c/cold.png" --frame=$mid --scale=0.3333333333333333 --gl=angle >/dev/null 2>&1
  seqf=$(ls out/detcheck/$c/seq/*$mid.png | head -1)
  bytes=$(cmp -s "$seqf" "out/detcheck/$c/cold.png" && echo "bytes-identical" || echo "bytes-differ")
  echo "$c frame $mid: $bytes; $(python3 scripts/pixdiff.py "$seqf" out/detcheck/$c/cold.png)"
done
