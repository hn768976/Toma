#!/usr/bin/env bash
# Renders the remaining finals one after another (software GL uses every core, so
# running them in parallel would not be faster). Waits for the first render to finish.
cd "$(dirname "$0")/.."
while pgrep -f "remotion render V1-hazard-barrels" >/dev/null; do sleep 5; done
r() { # project composition file
  ( cd "$1" && mkdir -p out && s=$(date +%s) && npx remotion render "$2" "out/$3" --codec=h264 --scale=0.5 --gl=angle --crf=16 --pixel-format=yuv420p --concurrency=1 --log=error > "out/$3.log" 2>&1; echo "$3 exit=$? seconds=$(( $(date +%s) - s ))" >> ../tools/render-times.txt )
}
r hazard-barrels V2-hazard-barrels 02-V2-hazard-barrels.mp4
r memory-chips V1-memory-chips 03-V1-memory-chips.mp4
r memory-chips V2-memory-chips 04-V2-memory-chips.mp4
