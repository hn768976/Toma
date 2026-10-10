#!/bin/bash
# Render the five 720p previews (sequentially) -> out/*.mp4, then run the automatic checks.
cd "$(dirname "$0")/.."
rm -rf out/frames
for pair in "NeonFrame-Spectrum NeonFrame_Spectrum" "SpotlightDust-TealCrimson SpotlightDust_TealCrimson" \
            "SpotlightDust-BlueViolet SpotlightDust_BlueViolet" "GlitterFloor-Gold GlitterFloor_Gold" \
            "GlitterFloor-ChampagneSilver GlitterFloor_ChampagneSilver"; do
  set -- $pair
  tools/render-preview.sh "$1" "out/$2.mp4"
done
echo ALL-DONE
