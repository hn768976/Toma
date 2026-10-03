#!/usr/bin/env bash
# Build wormhole-coins-map-burst-project.zip: source, config, pinned package files, public assets
# (HDRI, fonts, Natural Earth + licences), scripts and README. Leaves out node_modules, .git, refs/ and render output.
set -euo pipefail
cd "$(dirname "$0")/.."
NAME=wormhole-coins-map-burst
OUTZIP=$(realpath -m "${1:-../wormhole-coins-map-burst-project.zip}")
TMP=$(mktemp -d)
mkdir -p "$TMP/$NAME"
cp -r src public scripts README.md package.json package-lock.json remotion.config.ts tsconfig.json .gitignore "$TMP/$NAME/"
rm -f "$OUTZIP"
(cd "$TMP" && zip -qr -X "$OUTZIP" "$NAME")
rm -rf "$TMP"
echo "wrote $OUTZIP"; unzip -l "$OUTZIP" | tail -1
