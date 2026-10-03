#!/usr/bin/env bash
# Per-frame render time at 720p (--scale=1/3) and at 4K (--scale=1) for each
# look's A version. Startup (bundling, browser launch, asset load, shader
# compile) is measured with a 1-frame render and subtracted.
# Output: out/timing-measure.txt     env: BROWSER_EXECUTABLE (optional)
set -uo pipefail
cd "$(dirname "$0")/.."
BX=(); [ -n "${BROWSER_EXECUTABLE:-}" ] && BX=(--browser-executable="$BROWSER_EXECUTABLE")
OUT=out/timing-measure.txt
: > "$OUT"
npx remotion bundle src/index.ts --out-dir out/bundle --log=error >/dev/null 2>&1
t() { # comp scale frames
  local d=out/bench_run # no dot in the name: Remotion reads it as an extension
  rm -rf "$d"
  local s; s=$(date +%s.%N)
  npx remotion render out/bundle "$1" "$d" --sequence --image-format=png --scale="$2" --frames="$3" \
    --gl=angle --concurrency=2 "${BX[@]}" --log=error >/dev/null 2>&1
  echo "$(date +%s.%N) - $s" | bc
  rm -rf "$d"
}
for c in LowPolyLuxe-Gold CloudUpload PriceHouses-Dollar NetworkGrowth ConnectedGlobe; do
  s1=$(t "$c" 0.3333333333333333 200-200)
  s60=$(t "$c" 0.3333333333333333 200-259)
  k1=$(t "$c" 1 200-200)
  k10=$(t "$c" 1 200-209)
  p720=$(echo "scale=3; ($s60 - $s1) / 59" | bc)
  p4k=$(echo "scale=3; ($k10 - $k1) / 9" | bc)
  echo "$c 720p_s_per_frame=$p720 4k_s_per_frame=$p4k (startup 720p=${s1}s 4k=${k1}s)" | tee -a "$OUT"
done
