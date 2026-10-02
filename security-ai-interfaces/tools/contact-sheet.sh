#!/usr/bin/env bash
# Five evenly spaced frames (0, 120, 240, 360, 480) of each preview, tiled.
set -euo pipefail
cd "$(dirname "$0")/.."
source tools/comps.sh
mkdir -p renders/sheets
for row in "${COMPS[@]}"; do
  IFS='|' read -r id name fa fb <<< "$row"
  f="renders/previews/$name.mp4"; [ -f "$f" ] || continue
  ffmpeg -v error -y -i "$f" -vf "select='not(mod(n\,120))',scale=960:-1,tile=1x5" -frames:v 1 "renders/sheets/$name.png"
done
