#!/usr/bin/env bash
# Builds the delivery zip from a clean copy (no node_modules, .git, refs/, out/).
set -euo pipefail
cd "$(dirname "$0")/.."
NAME=networkgrowth-holopeople-timeline-aihub-gearworld-project
DEST=${1:-..}
TMP=$(mktemp -d)
mkdir -p "$TMP/$NAME"
tar --exclude=./node_modules --exclude=./.git --exclude=./refs --exclude=./out --exclude='*.zip' -cf - . | tar -xf - -C "$TMP/$NAME"
(cd "$TMP" && rm -f "$NAME.zip" && zip -qr "$NAME.zip" "$NAME")
mv "$TMP/$NAME.zip" "$DEST/"
rm -rf "$TMP"
echo "$DEST/$NAME.zip"
