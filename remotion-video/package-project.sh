#!/usr/bin/env bash
# Package the Remotion project for handoff: full source including the 4K
# compositions, excluding node_modules and rendered output. The recipient runs
# `npm install` and then `npx remotion studio`.
set -euo pipefail

cd "$(dirname "$0")"
NAME="${1:-woven-texture-remotion-project}"
OUT="$(pwd)/${NAME}.zip"
rm -f "$OUT"

# -x patterns are matched against the archive paths, so they are relative to the
# directory being zipped.
zip -r -q "$OUT" . \
  -x 'node_modules/*' \
  -x 'out/*' \
  -x '*.zip' \
  -x '.git/*' \
  -x '*.DS_Store' \
  -x '.env'

echo "$OUT"
unzip -l "$OUT" | tail -1
