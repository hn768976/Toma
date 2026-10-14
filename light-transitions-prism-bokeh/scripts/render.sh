#!/usr/bin/env bash
# Render one or more compositions as 720p previews: scripts/render.sh <id> [id...]
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p out/previews
for id in "$@"; do
  file=$(node -e "const s=require('fs').readFileSync('src/data.ts','utf8');const m=s.match(new RegExp('id: \"'+process.argv[1]+'\", file: \"([^\"]+)\"'));console.log(m[1])" "$id")
  start=$(date +%s.%N)
  npx remotion render src/index.ts "$id" "out/previews/$file.mp4" --scale=0.3333333333333333 --concurrency=4 --gl=angle --log=error >/dev/null
  end=$(date +%s.%N)
  echo "$id -> out/previews/$file.mp4 ($(echo "$end - $start" | bc) s)"
done
