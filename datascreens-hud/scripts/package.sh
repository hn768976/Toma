#!/usr/bin/env bash
# Zip the project for rendering elsewhere: no node_modules, .git, refs/ or render output.
set -euo pipefail
cd "$(dirname "$0")/.."
NAME=datascreens-vitalmonitor-hudtunnel-peoplenet-hudframe-project
DEST=${1:-../$NAME.zip}
rm -f "$DEST"
zip -r -X "$DEST" . \
  -x "node_modules/*" -x ".git/*" -x "refs/*" -x "renders/*" -x "out/*" -x "build/*" -x "dist/*" -x "*.DS_Store" >/dev/null
echo "wrote $DEST"
unzip -l "$DEST" | tail -1
