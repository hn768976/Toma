#!/usr/bin/env bash
# Zips the project for delivery (no node_modules, .git, refs/ or render output).
set -euo pipefail
cd "$(dirname "$0")/.."
NAME=steampunkframe-robotwalk-machineblueprint-oceandepth-project
DEST="${1:-out/$NAME.zip}"
rm -f "$DEST"
TMP=$(mktemp -d)
mkdir -p "$TMP/$NAME"
tar --exclude=./node_modules --exclude=./.git --exclude=./refs --exclude=./out --exclude=./dist --exclude=./build --exclude=__pycache__ -cf - . | tar -xf - -C "$TMP/$NAME"
ABS="$(pwd)/$DEST"
(cd "$TMP" && zip -qr "$ABS" "$NAME")
rm -rf "$TMP"
echo "wrote $DEST ($(du -h "$DEST" | cut -f1))"
