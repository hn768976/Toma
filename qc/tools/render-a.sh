#!/usr/bin/env bash
cd /home/user/Toma/circuit-chip-beam
R="--codec=h264 --scale=0.5 --gl=angle --crf=16 --pixel-format=yuv420p --log=error"
for pair in "V1-circuit-chip-beam 01-V1-circuit-chip-beam" "V2-circuit-chip-beam 02-V2-circuit-chip-beam"; do
  set -- $pair; T0=$(date +%s)
  npx remotion render $1 out/$2.mp4 $R && echo "$2 $(( $(date +%s) - T0 )) s" >> ../render-times.log
done
echo A DONE >> ../render-times.log
