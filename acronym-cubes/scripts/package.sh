#!/usr/bin/env bash
# Builds acronym-cubes-project.zip: source, font, config, lockfile, README.
# Leaves out node_modules, .git, build and render output.
set -euo pipefail
cd "$(dirname "$0")/.."
OUT="$(realpath -m "${1:-../acronym-cubes-project.zip}")"
rm -f "$OUT"
STAGE=$(mktemp -d)
mkdir -p "$STAGE/acronym-cubes"
git ls-files -co --exclude-standard . | while read -r f; do
  mkdir -p "$STAGE/acronym-cubes/$(dirname "$f")"
  cp "$f" "$STAGE/acronym-cubes/$f"
done
(cd "$STAGE" && zip -qr -X "$OUT" acronym-cubes)
rm -rf "$STAGE"
echo "wrote $OUT"
unzip -l "$OUT" | tail -1
