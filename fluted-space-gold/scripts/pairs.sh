#!/usr/bin/env bash
# Build neutral comparison pairs for the critic: pairs.sh <round>
set -e
R=$1; D=out/critic/r$R; mkdir -p $D
node scripts/stills.mjs FlutedGlass-Sunset out/test 0.3333333333333333 150 >/dev/null 2>&1
node scripts/stills.mjs FrostedFoil-Gold out/test 0.3333333333333333 150 >/dev/null 2>&1
node scripts/stills.mjs SunToAlphaCentauri-Clean out/test 0.3333333333333333 30,260,560 >/dev/null 2>&1
mk(){ mkdir -p $D/$1; ffmpeg -v error -y -ss $3 -i $2 -frames:v 1 $D/$1/image1.png; cp $4 $D/$1/image2.png; }
mk fluted refs/4037470201.mp4 5 out/test/FlutedGlass-Sunset_f150.png
mk foil refs/3412529285.mp4 5 out/test/FrostedFoil-Gold_f150.png
mk sun refs/sun-alpha-centauri.mp4 1 out/test/SunToAlphaCentauri-Clean_f030.png
mk warp refs/sun-alpha-centauri.mp4 9 out/test/SunToAlphaCentauri-Clean_f260.png
mk arrival refs/sun-alpha-centauri.mp4 18 out/test/SunToAlphaCentauri-Clean_f560.png
ls -R $D
