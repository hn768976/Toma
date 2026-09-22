#!/usr/bin/env bash
# Renders the eight 1080p previews, one 1080p still each, and the stills
# harvest. See README.md for the 4K commands.
set -u
cd "$(dirname "$0")"
export REMOTION_BROWSER_EXECUTABLE="${REMOTION_BROWSER_EXECUTABLE:-/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell}"

IDS=(DataRibbon-Bokeh DataRibbon-Minimal DataRibbon-Crossing DataRibbon-CrossingGreen
     CableBundle-Diagonal CableBundle-Rack CableBundle-Macro CableBundle-RackAmber)
NAMES=(DataRibbon_Bokeh DataRibbon_Minimal DataRibbon_Crossing DataRibbon_CrossingGreen
       CableBundle_Diagonal CableBundle_Rack CableBundle_Macro CableBundle_RackAmber)
# Well-separated frames: the digit field is completely different at each.
F1=(60 40 80 80 70 55 90 55); F2=(250 270 300 300 290 275 310 275); F3=(470 500 520 520 510 495 530 495)

for i in "${!IDS[@]}"; do
  id="${IDS[$i]}"; name="${NAMES[$i]}"
  echo "=== [$((i+1))/8] $id -> $name.mp4 ==="
  S=$(date +%s)
  npx remotion render "$id" "out/previews/$name.mp4" \
    --scale=0.5 --crf=16 --concurrency=4 --muted --log=error 2>&1 | tail -3
  echo "    video: $(( $(date +%s)-S ))s"
  npx remotion still "$id" "out/stills/$name.png" \
    --frame="${F1[$i]}" --scale=0.5 --log=error 2>&1 | tail -2
  echo "    still done"
done
echo "ALL PREVIEWS DONE"

# Stills harvest: 6000x3375 = scale 1.5625 on a 3840x2160 composition.
for i in "${!IDS[@]}"; do
  id="${IDS[$i]}"; name="${NAMES[$i]}"
  for f in "${F1[$i]}" "${F2[$i]}" "${F3[$i]}"; do
    npx remotion still "$id" "out/harvest/${name}_f${f}.png" \
      --frame="$f" --scale=1.5625 --log=error 2>&1 | tail -2
    echo "    harvest $name f$f"
  done
done
echo "ALL HARVEST DONE"
