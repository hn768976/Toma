#!/usr/bin/env bash
# Fit check: builds every tile atlas (one tiny still per periodic-table
# composition). buildAtlas() measures every number, symbol, name, mass,
# category, shell and oxidation string against its room and throws on any
# overflow, which fails this script (and any render).
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p out
for id in ElementGrid-Grey ElementGrid-IceBlue TableAssemble-Light TableAssemble-Dark TableFlyover-Blue TableFlyover-DarkGold; do
  npx remotion still src/index.ts "$id" "out/fitcheck_$id.png" --frame=0 --scale=0.1 --log=error
  echo "PASS  $id: all 118 tiles fit"
done
