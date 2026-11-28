#!/bin/bash
# Build <project>-project.zip for both projects (step 7): source, lockfile, config, README; no node_modules, .git, out or references.
set -e
ROOT=$(cd "$(dirname "$0")/.." && pwd)
mkdir -p "$ROOT/deliverables"
for P in conveyor-parcels mars-dome; do
  rm -f "$ROOT/deliverables/$P-project.zip"
  (cd "$ROOT" && zip -q -r -y "deliverables/$P-project.zip" "$P" -x "$P/node_modules/*" "$P/out/*" "$P/.git/*" "$P/dist/*" "*.DS_Store" "$P/refs/*")
  echo "$P-project.zip: $(du -h "$ROOT/deliverables/$P-project.zip" | cut -f1), $(unzip -l "$ROOT/deliverables/$P-project.zip" | tail -1)"
done
