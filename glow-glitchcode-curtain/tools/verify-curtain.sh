#!/bin/bash
cd "$(dirname "$0")/.."
for p in "LightCurtain-MagentaFire LightCurtain_MagentaFire CurtainMagenta" "LightCurtain-BlueTeal LightCurtain_BlueTeal CurtainBlue"; do
  set -- $p
  rm -rf out/verify/$1
  tools/verify.sh $1 $2
  python3 tools/analyze.py out/previews/$2.mp4 out/verify/$1 $3
  python3 tools/motion.py out/previews/$2.mp4 $3 out/verify/${3}_motion_strip.png
  for f in 150 450; do python3 tools/stretch.py out/verify/$1/${3}_mp4_f$f.png out/verify/$1/${3}_stretch_f$f.png 64; done
done
