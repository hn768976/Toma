#!/usr/bin/env bash
# Build stemcells-spiralbands-project.zip: source only (no node_modules,
# .git, refs/ or render output).
set -euo pipefail
cd "$(dirname "$0")/.."
out=${1:-../stemcells-spiralbands-project.zip}
tmp=$(mktemp -d)
dest="$tmp/stemcells-spiralbands"
mkdir -p "$dest"
cp -r src scripts package.json package-lock.json remotion.config.ts tsconfig.json README.md .gitignore "$dest/"
rm -f "$out"
(cd "$tmp" && zip -qr "$(realpath -m "$OLDPWD/$out")" stemcells-spiralbands)
rm -rf "$tmp"
echo "wrote $out"
