#!/usr/bin/env bash
# Steady-state render time per frame, one tab (--concurrency=1), no other load.
# Each measurement renders N frames and 1 frame; (t_N - t_1) / (N - 1) removes
# browser start-up, bundling and texture/particle setup.
#   720p: N = 31 (--scale=1/3)      4K: N = 3 (full 3840x2160)
set -euo pipefail
cd "$(dirname "$0")/.."
GL="${GL:-angle}"
T=$(mktemp -d)
run() { # id scale first last
  local s e
  s=$(date +%s.%N)
  npx remotion render "$1" "$T/r" --sequence --frames="$3-$4" --scale="$2" --gl="$GL" --concurrency=1 > /dev/null 2>&1
  e=$(date +%s.%N)
  rm -rf "$T/r"
  echo "$e - $s" | bc
}
for id in VintageMap-Europe CreamSwirl-Cream ParticleSmoke-Blue; do
  a=$(run "$id" 0.3333333333333333 100 130); b=$(run "$id" 0.3333333333333333 100 100)
  c=$(run "$id" 1 100 102); d=$(run "$id" 1 100 100)
  python3 -c "
a,b,c,d=$a,$b,$c,$d
print(f'$id: 720p {(a-b)/30:.2f} s/frame (31 frames {a:.0f} s, 1 frame {b:.0f} s); 4K {(c-d)/2:.1f} s/frame (3 frames {c:.0f} s, 1 frame {d:.0f} s)')"
done
rm -rf "$T"
