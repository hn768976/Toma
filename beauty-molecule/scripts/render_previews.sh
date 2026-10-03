#!/bin/sh
# Render the 4 x 720p previews (1280x720, H.264 yuv420p, 30fps, CRF 16) and
# a 720p PNG still of each into out/previews. Logs wall time per composition.
set -e
cd "$(dirname "$0")/.."
SCALE=0.3333333333333333
mkdir -p out/previews
for comp in DNA-Coral Structures-Coral DNA-Aqua Structures-Aqua; do
  id="BeautyMolecule-$comp"
  name="BeautyMolecule_$(echo "$comp" | tr - _)"
  start=$(date +%s.%N)
  npx remotion render "$id" "out/previews/$name.mp4" --scale=$SCALE --gl=angle \
    --codec=h264 --crf=16 --pixel-format=yuv420p --muted --log=error
  end=$(date +%s.%N)
  echo "$id: $(echo "$end - $start" | bc) s for 600 frames" | tee -a out/previews/render_times.txt
  npx remotion still "$id" "out/previews/$name.png" --frame=150 --scale=$SCALE --gl=angle --log=error
done
