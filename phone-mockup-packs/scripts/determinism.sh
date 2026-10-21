#!/usr/bin/env bash
# Cold-start vs warm render, byte for byte.
# For each target frame: (a) a fresh `remotion still` process renders only that
# frame; (b) a sequence render runs the 24 frames leading up to it in one tab
# (warm GL state, caches, previous frames). The PNGs must be identical.
# Usage: scripts/determinism.sh <bundle-or-entry> <workdir> <compId:frame,frame,frame> ...
set -euo pipefail
SRC=$1; WORK=$2; shift 2
SCALE=0.3333333333333333
mkdir -p "$WORK"
pass=0; fail=0
for spec in "$@"; do
  comp=${spec%%:*}; frames=${spec#*:}
  for f in ${frames//,/ }; do
    start=$(( f > 24 ? f - 24 : 0 ))
    npx remotion still "$SRC" "$comp" "$WORK/cold_${comp}_$f.png" --frame=$f --scale=$SCALE --gl=angle --image-format=png >/dev/null 2>&1
    rm -rf "$WORK/warm_${comp}_$f"
    npx remotion render "$SRC" "$comp" "$WORK/warm_${comp}_$f" --sequence --frames=$start-$f --scale=$SCALE --gl=angle --image-format=png --concurrency=1 >/dev/null 2>&1
    warm=$(ls "$WORK/warm_${comp}_$f"/*.png | sort | tail -1)
    a=$(sha256sum < "$WORK/cold_${comp}_$f.png" | cut -c1-16); b=$(sha256sum < "$warm" | cut -c1-16)
    if [ "$a" = "$b" ]; then pass=$((pass+1)); r=MATCH; else fail=$((fail+1)); r=DIFF; fi
    echo "$comp frame $f: cold $a  warm $b  $r"
  done
done
echo "determinism: $pass match, $fail differ"
