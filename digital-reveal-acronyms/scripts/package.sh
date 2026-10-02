#!/usr/bin/env bash
# Builds digital-reveal-acronyms-project.zip without node_modules, .git or render output.
set -euo pipefail
cd "$(dirname "$0")/.."
DEST=${1:-../deliverables/digital-reveal-acronyms-project.zip}
mkdir -p "$(dirname "$DEST")"
rm -f "$DEST"
zip -qr "$DEST" . -x "node_modules/*" "out/*" ".git/*" "*.mp4" ".DS_Store"
echo "$DEST"
unzip -l "$DEST" | tail -1
