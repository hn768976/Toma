#!/usr/bin/env bash
# Step 2: make the composition 601 frames (loopCheck prop), render frames 0
# and 600 as PNG stills, and require them to be identical pixel for pixel.
cd "$(dirname "$0")/.."
source scripts/ids.sh
mkdir -p out/checks
fail=0
for id in ${*:-$ALL_IDS}; do
  props="{\"versionId\":\"$id\",\"loopCheck\":true}"
  for fr in 0 600; do
    npx remotion still build "$id" "out/checks/${id}_loop_$fr.png" --frame=$fr \
      --scale=0.3333333333333333 --props="$props" --log=error >/dev/null
  done
  dur=$(npx remotion compositions build --props="$props" 2>/dev/null | grep -a "^$id " | awk '{print $4}')
  r=$(python3 scripts/pixeq.py "out/checks/${id}_loop_0.png" "out/checks/${id}_loop_600.png")
  echo "$id (duration=$dur frames) frame0 vs frame600: $r"
  [[ $r == IDENTICAL* ]] || fail=1
done
exit $fail
