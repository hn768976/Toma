#!/usr/bin/env bash
# Render-time measurements. Bundles once, then for each composition times:
#  a) a 1-frame still (startup + 1 frame), b) 30 frames on one tab, c) 30 frames on 4 tabs.
# per-frame(1 tab) = (b - a) / 29 ; per-frame(4 tabs) = (c - a) / 29
set -euo pipefail
cd "$(dirname "$0")/.."
npx remotion bundle src/index.ts --out-dir=out/bundle --log=error >/dev/null
mkdir -p out/timing
t() { local s=$(date +%s.%N); "$@" >/dev/null 2>&1; echo "$(date +%s.%N) - $s" | bc; }
for spec in LightSweep-Violet:90 LightSweep-Gold:90 FlareBurst-VioletGold:60 FlareBurst-Cyan:60 LightLeak-VioletBlue:180 LightLeak-WarmAmber:180 PrismLight-Rainbow:300 RedBokeh-RedGold:300; do
  id=${spec%%:*}; f=${spec##*:}
  a=$(t npx remotion still out/bundle $id out/timing/s.png --frame=$f --scale=0.3333333333333333)
  b=$(t npx remotion render out/bundle $id out/timing/seq1 --sequence --frames=$f-$((f+29)) --concurrency=1 --scale=0.3333333333333333)
  c=$(t npx remotion render out/bundle $id out/timing/seq4 --sequence --frames=$f-$((f+29)) --concurrency=4 --scale=0.3333333333333333)
  echo "$id still1=$a seq30_1tab=$b seq30_4tab=$c per_frame_1tab=$(echo "($b-$a)/29" | bc -l | cut -c1-5) per_frame_4tab=$(echo "($c-$a)/29" | bc -l | cut -c1-5)"
done
for spec in LightLeak-VioletBlue:180 RedBokeh-RedGold:300; do
  id=${spec%%:*}; f=${spec##*:}
  small=$(t npx remotion still out/bundle $id out/timing/s.png --frame=$f --scale=0.3333333333333333)
  big=$(t npx remotion still out/bundle $id out/timing/4k_$id.png --frame=$f --scale=1)
  echo "$id 4K still total=$big (720p still total=$small) -> 4K frame cost ~ $(echo "$big-$small" | bc) s + one 720p frame"
done
