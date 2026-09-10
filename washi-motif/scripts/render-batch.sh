#!/usr/bin/env bash
# Shell equivalent of scripts/render-batch.ts, for environments without the
# TypeScript loader. Renders the sixteen stills and the contact sheet.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p out/stills

PAIRS=(
  "w01 goldWhite" "w01 silverGold"
  "w02 goldWhite" "w02 sakuraPink"
  "w03 redGold"   "w03 goldWhite"
  "w04 goldBlack" "w04 indigoGold"
  "w05 goldWhite" "w05 sakuraPink"
  "w06 goldWhite" "w06 redGold"
  "w07 silverGold" "w07 goldWhite"
  "w08 goldWhite" "w08 indigoGold"
)

for pair in "${PAIRS[@]}"; do
  set -- $pair
  composition="$1"; palette="$2"
  out="out/stills/washi-${composition}-${palette}.png"
  echo "-> $out"
  npx remotion still WashiMotif "$out" \
    --props="{\"composition\":\"${composition}\",\"palette\":\"${palette}\"}"
done

echo "-> out/contact-sheet.png"
npx remotion still ContactSheet out/contact-sheet.png
