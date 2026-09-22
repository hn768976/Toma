#!/usr/bin/env bash
# Builds dataviz-project.zip: source only, ready to render at 4K elsewhere.
set -eu
cd "$(dirname "$0")"
OUT="${1:-../dataviz-project.zip}"
rm -f "$OUT"
zip -r -q "$OUT" \
  src public README.md package.json package-lock.json tsconfig.json \
  remotion.config.ts .gitignore \
  render-previews.sh harvest-stills.sh verify-loops.sh verify-outputs.sh analyze-banding.py \
  -x '*/node_modules/*' -x 'out/*' -x '*.DS_Store'
echo "wrote $OUT"
unzip -l "$OUT" | tail -3
