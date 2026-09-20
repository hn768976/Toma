#!/bin/sh
# Package the project for delivery: source only, no node_modules, no .git,
# no render output. Verified to `npm install && npx remotion studio` clean.
set -e
cd "$(dirname "$0")/.."
NAME=product-podium-set2-project
OUT=$(pwd)/../$NAME.zip
rm -f "$OUT"
zip -r -q "$OUT" . \
  -x 'node_modules/*' \
  -x '.git/*' \
  -x 'out/*' \
  -x '.DS_Store' \
  -x '*/.DS_Store'
echo "$OUT"
unzip -l "$OUT" | tail -3
