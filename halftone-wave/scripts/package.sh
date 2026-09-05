#!/usr/bin/env bash
# Packages the project as a 4K-render-ready zip: source, config, pinned
# package.json/package-lock.json and the README, with node_modules, .git and
# any render output left out.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
out="${1:-$root/out/halftone-wave-project.zip}"

mkdir -p "$(dirname "$out")"
rm -f "$out"
cd "$root"
zip -r -q "$out" \
  src \
  scripts \
  package.json \
  package-lock.json \
  tsconfig.json \
  remotion.config.ts \
  .gitignore \
  README.md \
  -x '*/.DS_Store'

echo "wrote $out"
