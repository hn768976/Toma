#!/usr/bin/env bash
# Packages the project for hand-off: everything needed to render (including the
# 4K compositions), minus installed dependencies and rendered output.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
out="${1:-$root/out/bloodstream-remotion-project.zip}"

mkdir -p "$(dirname "$out")"
rm -f "$out"

cd "$root"
zip -r -q "$out" . \
  -x 'node_modules/*' \
  -x 'out/*' \
  -x '.git/*' \
  -x '.DS_Store' \
  -x '**/.DS_Store'

echo "Wrote $out ($(du -h "$out" | cut -f1))"
echo "Unzip, then: npm install && node scripts/render.mjs --uhd"
