#!/bin/bash
# usage: verify/extract-cmp.sh <round>  -> out/cmp/<look>_r<round>_{a,b}.png
cd "$(dirname "$0")/.."
r=$1
x() { ffmpeg -v error -y -ss "$3" -i "refs/$2.mp4" -frames:v 1 "out/cmp/$1_r${r}_a.png"
      ffmpeg -v error -y -i "out/previews/$4.mp4" -vf "select=eq(n\,$5)" -frames:v 1 "out/cmp/$1_r${r}_b.png"; }
[ -f out/stills/DataMap_Blue.png ] && x dm 1059078932 3 DataMap_Blue 90
[ -f out/stills/PlexusGlobe_Navy.png ] && x px 19379656 3 PlexusGlobe_Navy 90
[ -f out/stills/CircuitWarp_Violet.png ] && x cw 21832948 3 CircuitWarp_Violet 90
[ -f out/stills/SoftGradient_Lime.png ] && x sg 4028541013 10 SoftGradient_Lime 300
[ -f out/stills/WirePeaks_White.png ] && x wp 1056902522 3 WirePeaks_White 90
true
