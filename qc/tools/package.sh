#!/usr/bin/env bash
# build the two project ZIPs (no node_modules, .git, out/ or reference clips)
set -euo pipefail
cd /home/user/Toma
for P in circuit-chip-beam golden-hourglass; do
  rm -f deliverables/$P-project.zip
  zip -qr deliverables/$P-project.zip $P -x "$P/node_modules/*" "$P/out/*" "$P/.git/*" "$P/dist/*" "*.mp4" "*/.DS_Store"
  echo "$P: $(du -h deliverables/$P-project.zip | cut -f1), $(unzip -l deliverables/$P-project.zip | tail -1)"
done
