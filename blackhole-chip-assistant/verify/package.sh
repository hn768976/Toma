#!/usr/bin/env bash
# Build blackhole-chip-assistant-project.zip: source, font, config, README.
# Leaves out node_modules, .git and render output.
set -euo pipefail
cd "$(dirname "$0")/.."
out="${1:-../blackhole-chip-assistant-project.zip}"
rm -f "$out"
zip -qr "$out" . -x 'node_modules/*' 'out/*' '.git/*' '*.DS_Store' 'dist/*'
echo "wrote $out"
