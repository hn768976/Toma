#!/usr/bin/env bash
#
# Packages the Remotion project for handoff: everything needed to open the
# 4K compositions and render them, and nothing that should be reinstalled.
#
#   ./scripts/make-project-zip.sh [output.zip]
#
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
out="${1:-$root/deliverables/Earth_Remotion_Project_4K.zip}"

mkdir -p "$(dirname "$out")"
rm -f "$out"

cd "$root"
zip -r -q "$out" \
  src \
  public \
  scripts \
  package.json \
  package-lock.json \
  remotion.config.ts \
  tsconfig.json \
  eslint.config.mjs \
  .prettierrc \
  .gitignore \
  README.md \
  EARTH.md \
  -x '*/node_modules/*' '*/.DS_Store' '*/out/*'

echo "Wrote $out ($(du -h "$out" | cut -f1))"
echo
echo "To use it:  unzip, npm install, npm run dev"
echo "To render:  npm run render:a4k   (or render:b4k / render:a / render:b)"
