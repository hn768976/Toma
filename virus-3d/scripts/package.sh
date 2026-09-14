#!/usr/bin/env bash
# Build the deliverable project zip: full source + the unmodified model +
# render scripts, with node_modules and rendered output left out.
set -euo pipefail
cd "$(dirname "$0")/.."

OUT="${1:-out/virus-3d-project.zip}"
mkdir -p "$(dirname "$OUT")"
rm -f "$OUT"

zip -r -q "$OUT" \
  src public scripts \
  package.json package-lock.json tsconfig.json remotion.config.ts \
  eslint.config.mjs .prettierrc .gitignore README.md \
  -x "*/.DS_Store"

echo "wrote $OUT"
unzip -l "$OUT" | tail -3
