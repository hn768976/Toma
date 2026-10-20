#!/usr/bin/env bash
# Build dist/painted-styles-project.zip (source, layers, draw-on frames, pinned skill + licence, no node_modules/.git/venv/renders)
# and dist/stills.zip (the 30 final stills).
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p dist
rm -f dist/painted-styles-project.zip dist/stills.zip
zip -q -r dist/painted-styles-project.zip \
  README.md requirements.txt StyleAudit.png StillsSheet.png docs scripts licenses audit \
  remotion/package.json remotion/package-lock.json remotion/tsconfig.json remotion/remotion.config.ts remotion/src remotion/public \
  vendor/claude-drawing-skill \
  -x 'vendor/claude-drawing-skill/.git/*' -x '*/__pycache__/*' -x '*.pyc'
(cd stills && zip -q -r ../dist/stills.zip *.png)
ls -la dist
