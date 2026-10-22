#!/usr/bin/env bash
# Zip the project source (no node_modules, .git, refs or render output).
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=${1:-out/neurons-flighttrails-dataserver-inkcloth-threads-proximity-project.zip}
rm -f "$OUT"
zip -qr "$OUT" README.md package.json package-lock.json tsconfig.json remotion.config.ts .gitignore src data tools \
  -x "*.DS_Store" "tools/__pycache__/*"
unzip -l "$OUT" | tail -1
