#!/usr/bin/env bash
# Builds the deliverable project zip: full Remotion source, both GLB models,
# fonts and render scripts. Excludes node_modules, the Remotion bundle and any
# rendered output, so the archive stays small and reproducible.
set -euo pipefail
cd "$(dirname "$0")/.."

OUT="${1:-out/dna-motion-plates-project.zip}"
mkdir -p "$(dirname "$OUT")"
rm -f "$OUT"

zip -r -q "$OUT" \
  src \
  public \
  scripts \
  package.json \
  package-lock.json \
  tsconfig.json \
  remotion.config.ts \
  eslint.config.mjs \
  .prettierrc \
  .gitignore \
  PROJECT.md \
  -x "*/node_modules/*" "*/.DS_Store"

echo "Wrote $OUT ($(du -h "$OUT" | cut -f1))"
