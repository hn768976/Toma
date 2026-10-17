#!/bin/bash
# Resumable: PNG sequences in out/frames/<name>, then 1280x720 H.264 previews.
cd "$(dirname "$0")/.."
mkdir -p out/frames out/previews out/logs
for pair in RainbowRings-Spectrum:RainbowRings_Spectrum RippleRings-Blue:RippleRings_Blue DataGrid-Teal:DataGrid_Teal \
            SunLeaves-Summer:SunLeaves_Summer SunLeaves-Autumn:SunLeaves_Autumn CloudSea-Loop:CloudSea_Loop \
            CloudFlight-Day:CloudFlight_Day CloudFlight-Sunset:CloudFlight_Sunset; do
  id=${pair%%:*}; name=${pair##*:}
  [ -s out/previews/$name.mp4 ] && continue
  s=$(date +%s)
  node scripts/render-seq.mjs $id out/frames/$name >> out/logs/$name.seq.log 2>&1 || { echo "$name FAILED" >> out/logs/summary.txt; continue; }
  ffmpeg -v error -y -framerate 30 -start_number 0 -i out/frames/$name/f%03d.png \
    -vf "scale=out_color_matrix=bt709:out_range=tv,format=yuv420p" \
    -c:v libx264 -crf 16 -preset slow -pix_fmt yuv420p -colorspace bt709 -color_primaries bt709 -color_trc bt709 \
    -r 30 -an -movflags +faststart out/previews/$name.mp4
  echo "$name $(( $(date +%s) - s ))s" >> out/logs/summary.txt
done
echo ALLDONE >> out/logs/summary.txt
