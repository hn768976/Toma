#!/usr/bin/env bash
# 6000x3375 PNG stills, 3 per composition (scale 1.5625 of 3840x2160),
# plus one 1080p PNG still of each composition.
set -uo pipefail
cd "$(dirname "$0")/.."
B=${BUNDLE:-out/bundle}
[ -d "$B" ] || npx remotion bundle --out-dir="$B" --log=error >/dev/null 2>&1
mkdir -p out/stills out/stills-1080
s() { # comp name frames...
  local c=$1 n=$2; shift 2
  for f in "$@"; do
    npx remotion still "$B" "$c" "out/stills/${n}_f$(printf %04d $f).png" --frame=$f --scale=1.5625 --log=error >/dev/null 2>&1 \
      && echo "ok $c $f" || echo "FAILED $c $f"
  done
  npx remotion still "$B" "$c" "out/stills-1080/${n}.png" --frame=$1 --scale=0.5 --log=error >/dev/null 2>&1 && echo "ok 1080 $c"
}
s BlackHole-Blue BlackHole_Blue 90 270 450
s BlackHole-Gold BlackHole_Gold 90 270 450
s ProcessorChip-Blue ProcessorChip_Blue 60 240 420
s ProcessorChip-Gold ProcessorChip_Gold 60 240 420
s AIAssistant-Neon AIAssistant_Neon 95 170 260
s AIAssistant-Terminal AIAssistant_Terminal 95 170 260
