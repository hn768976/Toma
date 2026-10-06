#!/usr/bin/env bash
# Build lock-wavemap-commodity-battery-trade-project.zip from tracked sources
# (no node_modules, .git, refs/ or render output).
set -euo pipefail
cd "$(dirname "$0")/.."
NAME=lock-wavemap-commodity-battery-trade
OUTZIP=${1:-out/$NAME-project.zip}
TMP=$(mktemp -d)
mkdir -p "$TMP/$NAME"
tar --exclude=./node_modules --exclude=./.git --exclude=./refs --exclude=./out --exclude=./dist -cf - . | tar -xf - -C "$TMP/$NAME"
mkdir -p "$(dirname "$OUTZIP")"
rm -f "$OUTZIP"
(cd "$TMP" && zip -qr "$OLDPWD/$OUTZIP" "$NAME")
rm -rf "$TMP"
echo "wrote $OUTZIP"
