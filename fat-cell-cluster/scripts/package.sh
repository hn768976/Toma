#!/bin/bash
# Build the deliverable zip: source only, ready to render at 4K elsewhere.
set -euo pipefail
cd "$(dirname "$0")/.."
NAME=fat-cell-cluster-project
rm -f "$NAME.zip"
zip -rq "$NAME.zip" \
  src scripts package.json package-lock.json tsconfig.json remotion.config.ts README.md .gitignore \
  -x "*/node_modules/*" "*/.git/*" "out/*" "scratch/*"
echo "$NAME.zip  $(du -h "$NAME.zip" | cut -f1)"
