#!/usr/bin/env bash
# Packages the Remotion project for delivery.
#
# Ships the sources, the GLB and the build config, but not node_modules, the
# render output or any local build artefacts: `npm i` reconstructs those, and
# including them would multiply the archive size for no benefit.
set -euo pipefail

OUT="${1:-neural-circuitry-4k-project.zip}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$ROOT"
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
  README.md \
  -x '*/node_modules/*' '*/out/*' '*/dist/*' '*.DS_Store'

echo "wrote $OUT ($(du -h "$OUT" | cut -f1))"
