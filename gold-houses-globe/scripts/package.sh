#!/usr/bin/env bash
# Build gold-houses-globe-project.zip: source, config, pinned package files,
# assets with licences, scripts and README. Leaves out node_modules, .git,
# refs/ and render output.
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=${1:-out/gold-houses-globe-project.zip}
rm -f "$OUT"
STAGE=$(mktemp -d)/gold-houses-globe
mkdir -p "$STAGE"
cp -r src public data-src licenses scripts "$STAGE/"
cp package.json package-lock.json tsconfig.json remotion.config.ts README.md .gitignore "$STAGE/"
(cd "$(dirname "$STAGE")" && zip -qr -X "$OLDPWD/$OUT" gold-houses-globe)
rm -rf "$(dirname "$STAGE")"
unzip -l "$OUT" | tail -1
