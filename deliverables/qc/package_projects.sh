#!/bin/bash
# Packages each Remotion project (source, config, lockfile, README, public/)
# into a ZIP, excluding node_modules and render outputs, then tests ZIP integrity.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT="$ROOT/deliverables"
for P in neon-pipes spiral-blooms; do
  rm -f "$OUT/$P-4k-remotion-project.zip"
  (cd "$ROOT" && zip -r -X -q "$OUT/$P-4k-remotion-project.zip" "$P" \
    -x "$P/node_modules/*" "$P/out/*" "$P/dist/*" "$P/.DS_Store")
  unzip -tq "$OUT/$P-4k-remotion-project.zip"
  (cd "$OUT" && sha256sum "$P-4k-remotion-project.zip")
done
