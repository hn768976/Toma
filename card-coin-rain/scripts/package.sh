#!/usr/bin/env bash
# Build card-coin-rain-project.zip: source + config + assets + licences.
# Leaves out node_modules, .git and render output.
set -euo pipefail
cd "$(dirname "$0")/.."
OUT="${1:-../card-coin-rain-project.zip}"
STAGE="$(mktemp -d)/card-coin-rain"
mkdir -p "$STAGE"
cp -r package.json package-lock.json remotion.config.ts tsconfig.json README.md .gitignore src scripts public licenses "$STAGE/"
rm -f "$OUT"
(cd "$(dirname "$STAGE")" && zip -qr -X "$OLDPWD/$OUT.tmp" card-coin-rain)
mv "$OUT.tmp" "$OUT"
echo "wrote $OUT ($(du -h "$OUT" | cut -f1))"
