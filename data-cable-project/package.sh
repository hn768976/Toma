#!/usr/bin/env bash
# Builds data-cable-project.zip: source, font, config, README. No
# node_modules, no .git, no render output.
set -eu
cd "$(dirname "$0")"
OUT="${1:-$PWD/../data-cable-project.zip}"
rm -f "$OUT"
zip -rq "$OUT" \
  src public README.md package.json package-lock.json \
  remotion.config.ts tsconfig.json render-all.sh package.sh verify.py .gitignore \
  -x "*/node_modules/*" "*/.git/*" "out/*" "*.DS_Store"
echo "wrote $OUT ($(du -h "$OUT" | cut -f1))"
unzip -l "$OUT" | tail -3
