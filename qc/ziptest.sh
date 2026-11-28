#!/bin/bash
# ZIP test (step 8A, item 9): extract each project ZIP into a fresh folder, install from the lockfile,
# and render one 4K frame of each composition with the README's commands.
# usage: ziptest.sh <fresh-folder> [browser-executable]
# The optional browser path is only for machines that cannot download Remotion's own headless browser.
ROOT=$(cd "$(dirname "$0")/.." && pwd)
T=$1; BR=${2:+--browser-executable=$2}
rm -rf "$T" && mkdir -p "$T"
RES="$ROOT/qc/results/ziptest.txt"; : > "$RES"
for P in conveyor-parcels mars-dome; do
  unzip -q "$ROOT/deliverables/$P-project.zip" -d "$T"
  cd "$T/$P"
  s=$(date +%s); npm ci --no-audit --no-fund > "$T/$P-npm-ci.log" 2>&1; rc=$?; e=$(date +%s)
  echo "$P npm-ci exit=$rc seconds=$((e-s)) files=$(find . -path ./node_modules -prune -o -type f -print | wc -l)" | tee -a "$RES"
  F=$([ $P = conveyor-parcels ] && echo 156 || echo 155)
  for V in V1 V2; do
    s=$(date +%s)
    npx remotion still $V-$P out/$V-frame.png --frame=$F --scale=1 --gl=angle $BR --log=error > "$T/$P-$V-still.log" 2>&1; rc=$?
    e=$(date +%s)
    dim=$(python3 -c "from PIL import Image; im=Image.open('out/$V-frame.png'); print(im.size[0], im.size[1])" 2>/dev/null)
    echo "$P $V-$P still exit=$rc seconds=$((e-s)) size=$dim" | tee -a "$RES"
  done
done
