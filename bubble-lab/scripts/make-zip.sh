#!/usr/bin/env bash
# Packages the Remotion project (4K compositions included) for handoff.
# Source only — node_modules and rendered output are excluded; `npm install`
# reproduces the environment from package-lock.json.
set -euo pipefail
cd "$(dirname "$0")/.."
OUT="${1:-../deliverables/serum-bubbles-remotion-project-4k.zip}"
rm -f "$OUT"
zip -rq "$OUT" \
  src scripts package.json package-lock.json tsconfig.json \
  remotion.config.ts README.md .gitignore
echo "$OUT"
unzip -l "$OUT" | tail -1
