#!/usr/bin/env bash
# Render one representative 4K still per look -> out/stills/
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p out/stills

BROWSER_ARGS=()
if [ -x "scripts/chrome-swiftshader.sh" ]; then
  BROWSER_ARGS=(--browser-executable="$PWD/scripts/chrome-swiftshader.sh")
fi

# look:frame — chosen to show each shot at its most representative moment
for spec in v01:150 v02:150 v03:250 v04:200 v05:200 v06:130 v07:400 v08:200 v09:110 v10:120; do
  id="${spec%%:*}"; frame="${spec##*:}"
  echo "=== ${id} @ frame ${frame}"
  npx remotion still "${id}-4k" "out/stills/${id}.png" \
    --frame="$frame" \
    --gl=swangle \
    "${BROWSER_ARGS[@]}" \
    --log=error
done
ls -la out/stills
