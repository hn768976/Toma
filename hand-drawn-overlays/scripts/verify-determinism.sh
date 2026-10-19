#!/usr/bin/env bash
# 6 Determinism: for each clip, render the full PNG sequence, then render
# the middle frame cold (a fresh browser, nothing rendered before it) and
# compare the two PNG files byte for byte. Also renders the loop check stills.
set -uo pipefail
cd "$(dirname "$0")/.."
BUNDLE="${BUNDLE:-out/bundle}"
S=0.3333333333333333
mkdir -p out/verify
declare -A LEN=([DoodlePack_WhiteOnBlack]=360 [DoodlePack_InkOnGreen]=360 [ScribbleWipe_Marker]=90 [ScribbleWipe_Ink]=90 \
  [Handwritten_Hello]=180 [Handwritten_ThankYou]=180 [Handwritten_Welcome]=180 [Handwritten_Subscribe]=180 \
  [NotebookPage_Loop]=600 [InkFlourish_Black]=150)
CLIPS=("$@"); [ ${#CLIPS[@]} -gt 0 ] || CLIPS=("${!LEN[@]}")
for name in "${CLIPS[@]}"; do
  id="${name//_/-}"; n=${LEN[$name]}; mid=$((n / 2))
  rm -rf "out/verify/seq/$name"
  npx remotion render "$BUNDLE" "$id" "out/verify/seq/$name" --sequence --image-format=png --scale=$S --log=error
  npx remotion still "$BUNDLE" "$id" "out/verify/cold_$name.png" --frame=$mid --image-format=png --scale=$S --log=error
  seqfile=$(ls "out/verify/seq/$name" | sort | sed -n "$((mid + 1))p")
  if cmp -s "out/verify/seq/$name/$seqfile" "out/verify/cold_$name.png"; then
    echo "PASS 6 determinism $name: cold frame $mid == full-render $seqfile (byte for byte)"
  else
    echo "FAIL 6 determinism $name: cold frame $mid differs from $seqfile"
  fi
done
npx remotion still "$BUNDLE" NotebookPage-LoopCheck out/verify/loop_0.png --frame=0 --image-format=png --scale=$S --log=error
npx remotion still "$BUNDLE" NotebookPage-LoopCheck out/verify/loop_600.png --frame=600 --image-format=png --scale=$S --log=error
