#!/usr/bin/env bash
# Build card-battery-globe-dollar-ticker-project.zip: source, config, pinned
# package files, fonts + data with licences, README and helper scripts.
# Leaves out node_modules, .git, refs/, build/ and render output.
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=${1:-out/card-battery-globe-dollar-ticker-project.zip}
rm -f "$OUT"
STAGE=$(mktemp -d)/card-battery-globe-dollar-ticker
mkdir -p "$STAGE"
cp -r src public scripts package.json package-lock.json remotion.config.ts tsconfig.json README.md .gitignore "$STAGE/"
(cd "$(dirname "$STAGE")" && zip -qr - card-battery-globe-dollar-ticker) > "$OUT"
echo "wrote $OUT ($(du -h "$OUT" | cut -f1))"
