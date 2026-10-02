#!/usr/bin/env bash
# Renders the six 1080p previews (--scale=0.5 of the 3840x2160 compositions)
# and logs wall time per composition to out/logs/.
set -uo pipefail
cd "$(dirname "$0")/.."
B=${BUNDLE:-out/bundle}
npx remotion bundle --out-dir="$B" --log=error >/dev/null 2>&1
mkdir -p out/previews out/logs
r() { # comp file
  local s=$(date +%s.%N)
  npx remotion render "$B" "$1" "out/previews/$2" --scale=0.5 --concurrency=${CONC:-1} --log=error > "out/logs/$2.log" 2>&1
  local rc=$?
  local e=$(date +%s.%N)
  echo "$1 $2 rc=$rc seconds=$(echo "$e - $s" | bc)" | tee -a out/logs/times.txt
}
( r BlackHole-Blue BlackHole_Blue.mp4; r BlackHole-Gold BlackHole_Gold.mp4 ) &
( r ProcessorChip-Blue ProcessorChip_Blue.mp4; r ProcessorChip-Gold ProcessorChip_Gold.mp4; r AIAssistant-Neon AIAssistant_Neon.mp4; r AIAssistant-Terminal AIAssistant_Terminal.mp4 ) &
wait
echo ALLDONE | tee -a out/logs/times.txt
