#!/usr/bin/env bash
# Loop + determinism checks at 720p (lossless PNG):
#  - loop: with loopCheck (301 frames), frame 300 must equal frame 0 pixel for pixel;
#  - determinism: a cold-start still of frame 150 (fresh browser, nothing cached)
#    must equal frame 150 of a full PNG-sequence render, byte for byte.
set -uo pipefail
cd "$(dirname "$0")/.."
D=${D:-out/checks}
mkdir -p "$D"
S=--scale=0.3333333333333333
IDS=${IDS:-"ScribbleEyes_Blue ScribbleEyes_OrangeOnWhite CrayonEyes_Blue CrayonEyes_Amber PaleEyes_Dark EyesCrowd_Dark UnknownPerson_Cycle UnknownPerson_Lineup"}
for id in $IDS; do
  cid=${id/_/-}
  npx remotion still out/bundle "$cid" "$D/${id}_loop000.png" --frame=0 $S --props='{"loopCheck":true}' --log=error
  npx remotion still out/bundle "$cid" "$D/${id}_loop300.png" --frame=300 $S --props='{"loopCheck":true}' --log=error
  echo -n "LOOP $id: "; python3 tools/png-compare.py "$D/${id}_loop000.png" "$D/${id}_loop300.png"
  npx remotion still out/bundle "$cid" "$D/${id}_cold150.png" --frame=150 $S --log=error
  rm -rf "$D/seq_$id"
  npx remotion render out/bundle "$cid" "$D/seq_$id" --sequence --image-format=png $S --log=error
  echo -n "DETERMINISM $id: "; python3 tools/png-compare.py "$D/${id}_cold150.png" "$D/seq_$id/element-150.png"
done
