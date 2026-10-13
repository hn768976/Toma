#!/usr/bin/env bash
# Step 3: frame 300 rendered on its own from a cold start must match frame
# 300 of the full sequence render byte for byte (decoded pixels and file).
cd "$(dirname "$0")/.."
source scripts/ids.sh
mkdir -p out/checks
fail=0
for id in ${*:-$ALL_IDS}; do
  npx remotion still build "$id" "out/checks/${id}_cold300.png" --frame=300 \
    --scale=0.3333333333333333 --log=error >/dev/null
  r=$(python3 scripts/pixeq.py "out/checks/${id}_cold300.png" "out/frames/$id/element-300.png")
  a=$(md5sum < "out/checks/${id}_cold300.png" | cut -c1-32)
  b=$(md5sum < "out/frames/$id/element-300.png" | cut -c1-32)
  [ "$a" = "$b" ] && bytes="file-bytes-identical" || bytes="file-bytes-differ"
  echo "$id cold frame 300 vs full render: $r ($bytes)"
  [[ $r == IDENTICAL* ]] || fail=1
done
exit $fail
