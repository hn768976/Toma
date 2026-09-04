#!/usr/bin/env bash
# Package this Remotion project as paper-ripple-project.zip, ready to render at
# 4K on another machine. Excludes node_modules, .git and any render output, so
# the zip is source + pinned package.json + config + README only.
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
out_zip="${1:-$project_root/paper-ripple-project.zip}"

rm -f "$out_zip"
cd "$project_root"
zip -r -q "$out_zip" . \
  -x 'node_modules/*' \
  -x '.git/*' \
  -x 'out/*' \
  -x '*.zip' \
  -x '.DS_Store'

echo "Wrote $out_zip"
