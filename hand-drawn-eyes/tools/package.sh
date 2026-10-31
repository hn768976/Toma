#!/usr/bin/env bash
# Zips the project for delivery: source, package.json/lock, README, tools.
# Leaves out node_modules, .git, refs/ and render output (out/).
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=${1:-out/hand-drawn-eyes-unknown-person-project.zip}
rm -f "$OUT"
zip -qr "$OUT" . -x 'node_modules/*' '.git/*' 'refs/*' 'out/*' '*.DS_Store'
unzip -l "$OUT" | tail -1
