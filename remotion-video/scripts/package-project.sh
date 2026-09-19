#!/usr/bin/env bash
# Packages the Remotion project for handoff: everything needed to open the
# studio, re-render at 1080p, or render the 4K compositions.
#
# Excludes node_modules and rendered output. Run `npm install` after unzipping.
set -euo pipefail
cd "$(dirname "$0")/.."

NAME="container-yard-remotion-project"
DEST="out/${NAME}.zip"
mkdir -p out
rm -f "$DEST"

zip -r -q "$DEST" \
  src \
  public \
  scripts \
  package.json \
  package-lock.json \
  tsconfig.json \
  remotion.config.ts \
  eslint.config.mjs \
  .prettierrc \
  README.md \
  -x '*/.DS_Store' \
  -x 'node_modules/*'

echo "wrote $DEST ($(du -h "$DEST" | cut -f1))"
unzip -l "$DEST" | tail -3
