#!/bin/bash
# Build topo-headline-ticker-ribbon-project.zip (no node_modules, .git, refs, render output).
set -e
cd "$(dirname "$0")/.."
OUT=${1:-../topo-headline-ticker-ribbon-project.zip}
rm -f "$OUT"
zip -qr "$OUT" . -x 'node_modules/*' -x 'out/*' -x 'refs/*' -x '.git/*' -x '*.zip'
unzip -l "$OUT" | tail -1
