#!/usr/bin/env bash
# perpetual-motion-project.zip (source, generated SVGs, docs, pinned anatomy + licence;
# no node_modules, .git or render output) and stills.zip (10 PNG + 10 SVG + StillsSheet).
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p renders/deliver
rm -f renders/deliver/perpetual-motion-project.zip renders/deliver/stills.zip
cd ..
zip -qr perpetual-motion/renders/deliver/perpetual-motion-project.zip perpetual-motion \
  -x "perpetual-motion/node_modules/*" "perpetual-motion/.git/*" "perpetual-motion/renders/*" \
     "perpetual-motion/out/*" "perpetual-motion/dist/*" "*.zip" "*/__pycache__/*"
cd perpetual-motion/renders/stills
zip -q ../deliver/stills.zip PerpetualMotion_*.png PerpetualMotion_*.svg StillsSheet.png
cd ../deliver && ls -la
