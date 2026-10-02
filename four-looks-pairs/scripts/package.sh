#!/usr/bin/env bash
# Zip the project for hand-off: source, config, fonts + licences, scripts, lockfile.
# Leaves out node_modules, .git and render output.
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=${1:-out/deliverables/four-looks-pairs-project.zip}
mkdir -p "$(dirname "$OUT")"
rm -f "$OUT"
ABS_OUT=$(cd "$(dirname "$OUT")" && pwd)/$(basename "$OUT")
cd ..
zip -qr "$ABS_OUT" four-looks-pairs -x "four-looks-pairs/node_modules/*" "four-looks-pairs/out/*" \
  "four-looks-pairs/.git/*" "four-looks-pairs/dist/*" "*.DS_Store"
echo "$ABS_OUT"
unzip -l "$ABS_OUT" | tail -1
