#!/usr/bin/env bash
# Zip the project for hand-off (no node_modules, .git or render output).
set -euo pipefail
cd "$(dirname "$0")/.."
DEST=${1:-../cosmic-energy-pairs-project.zip}
rm -f "$DEST"
cd ..
zip -qr "$DEST" cosmic-energy-pairs \
  -x 'cosmic-energy-pairs/node_modules/*' 'cosmic-energy-pairs/out/*' 'cosmic-energy-pairs/renders/*' \
     'cosmic-energy-pairs/.git/*' 'cosmic-energy-pairs/dist/*' '*/.DS_Store' '*/__pycache__/*'
echo "wrote $DEST"; unzip -l "$DEST" | tail -1
