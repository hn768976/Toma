#!/usr/bin/env bash
# Builds trading-terminal-project.zip: source, config, fonts + licences, README.
# Leaves out node_modules, .git, refs/ and render output.
set -euo pipefail
cd "$(dirname "$0")/.."
OUT="${1:-../trading-terminal-project.zip}"
rm -f "$OUT"
zip -qr "$OUT" . -x "node_modules/*" "out/*" "refs/*" ".git/*" "*.DS_Store"
echo "$OUT"; unzip -l "$OUT" | tail -1
