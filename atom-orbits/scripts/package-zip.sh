#!/usr/bin/env bash
# Builds atom-orbit-project.zip: source, config, pinned package.json/lock, README.
# Leaves out node_modules, .git and render output.
set -euo pipefail
cd "$(dirname "$0")/.."
OUT="${1:-../atom-orbit-project.zip}"
rm -f "$OUT"
zip -r -X "$OUT" . -x 'node_modules/*' 'out/*' '.git/*' '*.DS_Store' >/dev/null
echo "wrote $OUT"; unzip -l "$OUT" | tail -1
