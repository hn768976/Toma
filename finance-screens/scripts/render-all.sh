#!/usr/bin/env bash
# Bundles once, then renders + verifies every version (720p previews).
# usage: scripts/render-all.sh [id ...]   (default: all ten)
set -uo pipefail
cd "$(dirname "$0")/.."
npx remotion bundle src/index.ts --out-dir build --log=error >/dev/null
ROWS=$(node -e "
const s=require('fs').readFileSync('src/versions.ts','utf8');
const ids=[...s.matchAll(/\bid: \"([^\"]+)\",\s*\n\s*file: \"([^\"]+)\"/g)].map(m=>m[1]+':'+m[2]);
console.log(ids.join(' '))")
for row in $ROWS; do
  id=${row%%:*}; file=${row##*:}
  if [ $# -gt 0 ] && [[ ! " $* " =~ " $id " ]]; then continue; fi
  scripts/render-preview.sh "$id" "$file" && python3 -I scripts/verify.py "$id" "$file" | tee -a logs/verify.jsonl
done
