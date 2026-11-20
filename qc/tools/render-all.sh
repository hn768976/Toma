#!/usr/bin/env bash
# final 1080p renders, two chains in parallel
cd /home/user/Toma
R="--codec=h264 --scale=0.5 --gl=angle --crf=16 --pixel-format=yuv420p --log=error"
( cd circuit-chip-beam && mkdir -p out && rm -f out/0*.mp4 \
  && { T0=$(date +%s); npx remotion render V1-circuit-chip-beam out/01-V1-circuit-chip-beam.mp4 $R; echo "01-V1-circuit-chip-beam $(( $(date +%s) - T0 )) s" >> ../render-times.log; } \
  && { T0=$(date +%s); npx remotion render V2-circuit-chip-beam out/02-V2-circuit-chip-beam.mp4 $R; echo "02-V2-circuit-chip-beam $(( $(date +%s) - T0 )) s" >> ../render-times.log; } ) &
( cd golden-hourglass && mkdir -p out && rm -f out/0*.mp4 \
  && { T0=$(date +%s); npx remotion render V1-golden-hourglass out/03-V1-golden-hourglass.mp4 $R; echo "03-V1-golden-hourglass $(( $(date +%s) - T0 )) s" >> ../render-times.log; } \
  && { T0=$(date +%s); npx remotion render V2-golden-hourglass out/04-V2-golden-hourglass.mp4 $R; echo "04-V2-golden-hourglass $(( $(date +%s) - T0 )) s" >> ../render-times.log; } ) &
wait
echo ALL DONE >> render-times.log
