#!/bin/sh
# Build the deliverable zip: source only, ready to render at 4K elsewhere.
# Excludes node_modules, .git and render output.
set -e
cd "$(dirname "$0")/.."
rm -f blade-array-project.zip
zip -q -r blade-array-project.zip \
  src scripts package.json package-lock.json remotion.config.ts tsconfig.json \
  README.md .gitignore \
  -x '*/node_modules/*' '*/.git/*' 'out/*' '*.DS_Store'
echo "wrote $(pwd)/blade-array-project.zip"
unzip -l blade-array-project.zip | tail -3
