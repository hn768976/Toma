#!/usr/bin/env bash
# Builds the three standalone distribution archives.
#
# Each archive is the whole project — all three compositions, all sources,
# the figure asset and a README written for that archive's composition.
# node_modules/, out/ and .git/ are excluded; every library component is
# vendored under src/lib so an archive needs nothing outside itself.
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT=$(pwd)
STAGE=$(mktemp -d)
trap 'rm -rf "$STAGE"' EXIT

for variant in gold cool inward; do
  name="meditation-$variant"
  dir="$STAGE/$name"
  mkdir -p "$dir"
  cp -R src public package.json package-lock.json tsconfig.json \
        remotion.config.ts .gitignore "$dir/"
  python3 scripts/make-readme.py "$variant" "$dir/README.md"
  ( cd "$STAGE" && zip -qr "$ROOT/dist/$name.zip" "$name" \
      -x '*/node_modules/*' '*/out/*' '*/.git/*' )
  echo "built dist/$name.zip"
done
