#!/bin/bash
# Builds the delivery ZIPs (source + config + lockfile; node_modules/out excluded).
set -e
D=/home/user/Toma/deliverables
cd /home/user/Toma/projects
for p in data-cube-assembly:Data-Cube-Assembly topographic-network-pins:Topographic-Network-Pins; do
  dir=${p%%:*}; name=${p##*:}
  rm -f "$D/${name}_Remotion-4K-Project.zip"
  zip -qr -X "$D/${name}_Remotion-4K-Project.zip" "$dir" -x "$dir/node_modules/*" "$dir/out/*" "$dir/dist/*" "$dir/build/*"
  unzip -tq "$D/${name}_Remotion-4K-Project.zip"
done
