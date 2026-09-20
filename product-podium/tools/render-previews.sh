#!/bin/sh
# 1080p previews of the four variant-A compositions, plus a 1080p still each.
set -e
cd "$(dirname "$0")/.."
render() {
  id=$1; name=$2; frame=$3
  S=$(date +%s)
  npx remotion render "$id" "out/preview/$name.mp4" --scale=0.5 --crf=16
  E=$(date +%s)
  echo "TIMING $id video $((E-S))s total, $(echo "scale=3;($E-$S)/300"|bc)s/frame"
  npx remotion still "$id" "out/stills/$name.png" --frame="$frame" --scale=0.5
  echo "DONE $name"
}
render NeonRing-PodiumBlue            NeonRing_PodiumBlue            96
render FlutedPlaster-PodiumCylinder   FlutedPlaster_PodiumCylinder   150
render WoodLeaf-PodiumCool            WoodLeaf_PodiumCool            210
render DuotoneGlass-PodiumMagentaCyan DuotoneGlass_PodiumMagentaCyan 42
echo ALL_DONE
