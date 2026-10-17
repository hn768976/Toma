#!/bin/bash
# Renders all 8 previews at 1280x720 from the bundle in ./build.
mkdir -p out/previews out/logs
for pair in RainbowRings-Spectrum:RainbowRings_Spectrum RippleRings-Blue:RippleRings_Blue DataGrid-Teal:DataGrid_Teal \
            SunLeaves-Summer:SunLeaves_Summer SunLeaves-Autumn:SunLeaves_Autumn CloudSea-Loop:CloudSea_Loop \
            CloudFlight-Day:CloudFlight_Day CloudFlight-Sunset:CloudFlight_Sunset; do
  id=${pair%%:*}; name=${pair##*:}
  [ -f out/previews/$name.mp4 ] && continue
  s=$(date +%s)
  npx remotion render build $id out/previews/$name.tmp.mp4 --scale=0.3333333333333333 --codec=h264 --crf=16 \
    --pixel-format=yuv420p --muted --concurrency=${CONC:-2} > out/logs/$name.log 2>&1 \
    && mv out/previews/$name.tmp.mp4 out/previews/$name.mp4
  echo "$name $(( $(date +%s) - s ))s exit=$?" >> out/logs/summary.txt
done
echo ALLDONE >> out/logs/summary.txt
