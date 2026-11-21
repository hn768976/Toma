#!/usr/bin/env bash
# Builds <name>-project.zip for each project: source, lockfile, config, assets, README,
# look-dev comparisons and scripts. Leaves out node_modules, .git, out/ and scratch renders.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p deliverables
for p in hazard-barrels memory-chips; do
  rm -f "deliverables/$p-project.zip"
  zip -q -r "deliverables/$p-project.zip" "$p" \
    -x "$p/node_modules/*" "$p/out/*" "$p/.git/*" "$p/lookdev/tmp/*" "$p/*.mp4" "$p/**/.DS_Store"
  echo "$p: $(du -h deliverables/$p-project.zip | cut -f1), $(unzip -l deliverables/$p-project.zip | tail -1)"
done
