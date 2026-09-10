#!/usr/bin/env bash
# Builds security-alert-project.zip: the full source tree, pinned manifests
# and embedded fonts, without node_modules or rendered output.
set -euo pipefail
cd "$(dirname "$0")"
OUT="${1:-../deliverables/security-alert-project.zip}"
mkdir -p "$(dirname "$OUT")"
rm -f "$OUT"
zip -r -q "$OUT" \
  src public README.md package.json package-lock.json \
  remotion.config.ts tsconfig.json eslint.config.mjs .gitignore \
  -x '*/node_modules/*' '*/.DS_Store'
echo "wrote $OUT"
