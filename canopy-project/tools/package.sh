#!/usr/bin/env bash
# Builds canopy-project.zip: the full Remotion project, ready to render at 4K
# elsewhere. Excludes node_modules, .git and any render output.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
out="${1:-$here/../canopy-project.zip}"

rm -f "$out"
cd "$here"
zip -r -q "$out" \
  README.md \
  package.json \
  package-lock.json \
  tsconfig.json \
  remotion.config.ts \
  .gitignore \
  .npmrc \
  src \
  public \
  tools \
  -x '*/node_modules/*' '*/.git/*' 'out/*' '*.DS_Store' 'tools/.build/*'

echo "wrote $out"
unzip -l "$out" | tail -1
