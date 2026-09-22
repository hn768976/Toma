#!/usr/bin/env bash
set -u
cd "$(dirname "$0")"
export REMOTION_BROWSER_EXECUTABLE="${REMOTION_BROWSER_EXECUTABLE:-/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell}"
IDS=(CableBundle-Rack CableBundle-RackAmber)
NAMES=(CableBundle_Rack CableBundle_RackAmber)
F1=(55 55); F2=(275 275); F3=(495 495)
for i in "${!IDS[@]}"; do
  id="${IDS[$i]}"; name="${NAMES[$i]}"
  echo "=== $id ==="; S=$(date +%s)
  npx remotion render "$id" "out/previews/$name.mp4" --scale=0.5 --crf=16 --concurrency=4 --muted --log=error 2>&1|tail -2
  echo "    video: $(( $(date +%s)-S ))s"
  npx remotion still "$id" "out/stills/$name.png" --frame="${F1[$i]}" --scale=0.5 --log=error 2>&1|tail -1
  for f in "${F1[$i]}" "${F2[$i]}" "${F3[$i]}"; do
    rm -f "out/harvest/${name}_f"*.png
  done
  for f in "${F1[$i]}" "${F2[$i]}" "${F3[$i]}"; do
    npx remotion still "$id" "out/harvest/${name}_f${f}.png" --frame="$f" --scale=1.5625 --log=error 2>&1|tail -1
    echo "    harvest $name f$f"
  done
done
echo "RACK RERENDER DONE"
