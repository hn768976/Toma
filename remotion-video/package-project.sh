#!/usr/bin/env bash
# Packages the Remotion project for hand-off: everything needed to open the 4K
# compositions in Remotion Studio and re-render them, and nothing generated.
set -euo pipefail
cd "$(dirname "$0")"

OUT="out/SpiralFlow_Remotion_Project.zip"
mkdir -p out
rm -f "$OUT"

zip -r -q "$OUT" \
  src \
  public \
  package.json package-lock.json tsconfig.json remotion.config.ts \
  eslint.config.mjs .prettierrc .gitignore \
  README.md SPIRAL_FLOW.md \
  render-all.sh render-chunked.sh deliver.sh verify.sh look.sh \
  -x '*/node_modules/*' '*/.DS_Store' '*/out/*'

echo "wrote $OUT"
unzip -l "$OUT" | tail -1
