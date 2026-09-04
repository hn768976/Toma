#!/usr/bin/env bash
# Builds ai-hologram-project.zip — everything needed to render at 4K on another
# machine, and nothing that should be rebuilt or re-rendered there.
set -euo pipefail
cd "$(dirname "$0")/.."

OUT="${1:-$(cd .. && pwd)/deliverables/ai-hologram-project.zip}"
mkdir -p "$(dirname "$OUT")"
rm -f "$OUT"
zip -r -q "$OUT" . \
  -x "node_modules/*" \
  -x ".git/*" \
  -x "out/*" \
  -x ".remotion/*" \
  -x "*.zip"
echo "$OUT"
unzip -l "$OUT" | tail -1
