#!/usr/bin/env bash
# Render 1280x720 previews of the given compositions (default: all 7) and log
# wall time per composition to renders/timings.txt.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p renders
IDS=("$@")
if [ ${#IDS[@]} -eq 0 ]; then
  IDS=(DataScreens-WhiteOverlay VitalMonitor-Teal VitalMonitor-Green HUDTunnel-Blue PeopleNetwork-Navy PeopleNetwork-White HUDFrame-WhiteOverlay)
fi
for id in "${IDS[@]}"; do
  out="renders/${id/-/_}.mp4"
  start=$(date +%s.%N)
  npx remotion render src/index.ts "$id" "$out" --scale=0.3333333333333333 --log=error
  end=$(date +%s.%N)
  wall=$(echo "$end - $start" | bc)
  echo "$id wall=${wall}s per_frame=$(echo "scale=3; $wall / 600" | bc)s" | tee -a renders/timings.txt
  npx remotion still src/index.ts "$id" "renders/${id/-/_}.png" --frame=150 --scale=0.3333333333333333 --log=error
done
