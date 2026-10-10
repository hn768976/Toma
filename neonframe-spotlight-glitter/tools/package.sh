#!/bin/bash
# Build neonframe-spotlight-glitter-project.zip (no node_modules, .git, refs/ or render output).
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=${1:-neonframe-spotlight-glitter-project.zip}
rm -f "$OUT"
zip -r -q "$OUT" . \
  -x "node_modules/*" ".git/*" "refs/*" "out/*" "deliverables/*" "dist/*" "build/*" "*.mp4" "*.zip" ".DS_Store" "*.log" ".remotion/*"
unzip -l "$OUT" | tail -n +4 | awk '{print $4}' | grep -v '^$' | head -100
