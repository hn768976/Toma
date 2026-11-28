#!/bin/bash
# package.sh - build one ZIP per project into deliverables/
# Leaves out node_modules, .git, out/ and anything containing reference
# footage (lookdev/ holds reference frames, so it stays out of the ZIPs and
# is shipped next to the QC report instead).
set -e
cd /home/user/Toma
mkdir -p deliverables
for p in ai-chip-reveal chip-ignite; do
  rm -f deliverables/$p-project.zip
  zip -q -r -y deliverables/$p-project.zip $p \
    -x "$p/node_modules/*" "$p/out/*" "$p/.git/*" "$p/lookdev/*" "$p/dist/*" "*.DS_Store"
  echo "$p-project.zip: $(du -h deliverables/$p-project.zip | cut -f1), $(unzip -l deliverables/$p-project.zip | tail -1)"
done
