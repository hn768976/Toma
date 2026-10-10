#!/bin/bash
# Determinism: frames 290-310 rendered as a multi-threaded sequence; compare 300 with the cold still.
# Timing: single-thread 720p, (t[0-20] - t[0-0]) / 20 = per-frame cost without browser start-up.
ALL="ParticleGlobe-Blue DotShells-BlueCoral DotShells-VioletGold CandleChart-Blue CandleChart-Emerald LightArc-Gold DotTunnel-Blue DotTunnel-Violet"
S=0.3333333333333333
for c in $ALL; do
  npx remotion render build $c out/seq/$c --sequence --frames=290-310 --scale=$S --concurrency=4 --image-format=png >/dev/null 2>&1
  t0=$(date +%s.%N); npx remotion render build $c out/seq/t1 --sequence --frames=0-0 --scale=$S --concurrency=1 --image-format=png >/dev/null 2>&1; t1=$(date +%s.%N)
  npx remotion render build $c out/seq/t21 --sequence --frames=0-20 --scale=$S --concurrency=1 --image-format=png >/dev/null 2>&1; t2=$(date +%s.%N)
  echo "$c per-frame(720p,1 thread)= $(echo "(($t2-$t1)-($t1-$t0))/20" | bc -l | cut -c1-5) s"
done
