#!/usr/bin/env bash
# Zips the project for rendering elsewhere: source, config, pinned package
# files, HDRI + Natural Earth data with licences, scripts and README.
# Leaves out node_modules, .git, refs/, build/ and render output (out/).
set -euo pipefail
cd "$(dirname "$0")/.."
NAME=chart-circuit-shards-project
DEST=${1:-out/$NAME.zip}
mkdir -p "$(dirname "$DEST")"
rm -f "$DEST"
TMP=$(mktemp -d)
mkdir "$TMP/$NAME"
tar -cf - --exclude=node_modules --exclude=.git --exclude=refs --exclude='build*' --exclude=out \
  --exclude='*.zip' --exclude=__pycache__ . | tar -xf - -C "$TMP/$NAME"
(cd "$TMP" && zip -qr "$OLDPWD/$DEST" "$NAME")
rm -rf "$TMP"
echo "wrote $DEST ($(du -h "$DEST" | cut -f1))"
