#!/usr/bin/env bash
# Builds the deliverable ai-hud-project.zip: the whole Remotion project,
# without node_modules, .git or render output.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT="${1:-$HERE/../deliverables/ai-hud-project.zip}"
mkdir -p "$(dirname "$OUT")"
rm -f "$OUT"
cd "$HERE"
zip -q -r "$OUT" . \
  -x 'node_modules/*' \
  -x '.git/*' \
  -x 'out/*' \
  -x 'stills/*' \
  -x '.DS_Store' \
  -x '**/.DS_Store'
echo "wrote $OUT"
unzip -l "$OUT" | tail -1
