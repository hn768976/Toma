#!/usr/bin/env bash
# Build commodities-board-project.zip: the full Remotion project, ready to
# render at 4K elsewhere. Excludes node_modules, .git and any render output.
set -euo pipefail
cd "$(dirname "$0")"
OUT="${1:-out/commodities-board-project.zip}"
mkdir -p "$(dirname "$OUT")"
rm -f "$OUT"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$TMP/commodities-board"
cp -r src public package.json package-lock.json tsconfig.json remotion.config.ts \
      README.md .gitignore package-project.sh "$TMP/commodities-board/"
( cd "$TMP" && zip -qr "project.zip" commodities-board -x '*/node_modules/*' '*/out/*' '*/.git/*' )
mv "$TMP/project.zip" "$OUT"
echo "wrote $OUT"
