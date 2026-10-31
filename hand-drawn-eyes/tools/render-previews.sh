#!/usr/bin/env bash
# Renders the 720p previews (1280x720) of all 8 compositions and logs timings.
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=${OUT:-out/previews}
mkdir -p "$OUT"
IDS=${IDS:-"ScribbleEyes_Blue ScribbleEyes_OrangeOnWhite CrayonEyes_Blue CrayonEyes_Amber PaleEyes_Dark EyesCrowd_Dark UnknownPerson_Cycle UnknownPerson_Lineup"}
npx remotion bundle src/index.ts --out-dir=out/bundle >/dev/null
for id in $IDS; do
  t0=$(date +%s.%N)
  npx remotion render out/bundle "${id/_/-}" "$OUT/$id.mp4" --scale=0.3333333333333333 --log=error ${EXTRA:-}
  t1=$(date +%s.%N)
  echo "$id $(echo "$t1 - $t0" | bc)" | tee -a "$OUT/timings.txt"
done
