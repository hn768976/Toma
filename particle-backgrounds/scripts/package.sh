#!/usr/bin/env bash
# Builds particle-backgrounds-project.zip (source only: no node_modules, .git, render output).
set -euo pipefail
DEST=${1:-../deliverables/particle-backgrounds-project.zip}
DEST=$(realpath -m "$DEST")
rm -f "$DEST"
cd ..
zip -qr "$DEST" particle-backgrounds \
  -x 'particle-backgrounds/node_modules/*' 'particle-backgrounds/.git/*' 'particle-backgrounds/out/*' \
     'particle-backgrounds/renders/*' 'particle-backgrounds/build/*' '*.DS_Store'
echo "wrote $DEST"
