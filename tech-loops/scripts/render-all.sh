#!/usr/bin/env bash
# Renders every version row's 720p preview. Optional args: a subset of composition ids.
set -euo pipefail
cd "$(dirname "$0")/.."
ROWS=$(node -e '
const src = require("fs").readFileSync("src/versions.ts", "utf8");
const re = /id: "([^"]+)", file: "([^"]+)"/g; let m;
while ((m = re.exec(src))) console.log(m[1] + " " + m[2]);')
while read -r ID STEM; do
  if [ $# -gt 0 ] && [[ ! " $* " =~ " $ID " ]]; then continue; fi
  scripts/render-preview.sh "$ID" "$STEM" < /dev/null
done <<< "$ROWS"
