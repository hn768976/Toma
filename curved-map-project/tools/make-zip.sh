#!/usr/bin/env bash
# Packages the project for handoff: source, the baked Natural Earth mask, the
# config and the pinned manifests. No node_modules, no .git, no render output.
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
out="${1:-$root/../curved-map-project.zip}"
rm -f "$out"
cd "$root/.."
zip -r -q "$out" "$(basename "$root")" \
  -x "*/node_modules/*" "*/.git/*" "*/out/*" "*/.DS_Store" "*/build/*"
echo "wrote $out"
