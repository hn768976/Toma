#!/usr/bin/env bash
# Builds hud-dash-blue.zip and hud-dash-amber.zip in dist/.
# Excludes node_modules/, out/, .git/.
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"
rm -rf dist
mkdir -p dist

for variant in blue amber; do
  stage="dist/stage-$variant/hud-dash-$variant"
  mkdir -p "$stage"
  cp -R src "$stage/"
  cp -R public "$stage/"
  cp package.json tsconfig.json remotion.config.ts .gitignore "$stage/"
  bash tools/make-readme.sh "$variant" "$stage"
  (cd "dist/stage-$variant" && zip -rq "../hud-dash-$variant.zip" "hud-dash-$variant")
  rm -rf "dist/stage-$variant"
done

ls -la dist/*.zip
