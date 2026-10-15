#!/usr/bin/env bash
# Packages the project as a zip, without node_modules, .git, refs/ or render output.
set -euo pipefail
cd "$(dirname "$0")/../.."
NAME=periodictable-datapanels-tower
OUT=${1:-$NAME/deliver/$NAME-project.zip}
rm -f "$OUT"
zip -r -q "$OUT" "$NAME" \
  -x "$NAME/node_modules/*" "$NAME/.git/*" "$NAME/refs/*" "$NAME/build/*" \
     "$NAME/out/*" "$NAME/renders/*" "$NAME/deliver/*" "$NAME/*.zip"
echo "wrote $OUT"
