#!/bin/bash
# Render 720p previews: PNG sequence via Remotion (--scale=1/3 of the 4K
# composition), then encode H.264 yuv420p CRF16 30fps with ffmpeg.
# usage: scripts/render_previews.sh [CompId ...]   (default: all 8)
set -u
cd "$(dirname "$0")/.."
BUNDLE=${BUNDLE:-out/bundle}
declare -A FILE=(
  [DataGridSpace-Blue]=DataGridSpace_Blue
  [ParticleOrb-VioletBlue]=ParticleOrb_VioletBlue
  [ParticleOrb-TealGold]=ParticleOrb_TealGold
  [CellCluster-MicroscopeBlue]=CellCluster_MicroscopeBlue
  [PillarField-BlueViolet]=PillarField_BlueViolet
  [PillarField-CopperGold]=PillarField_CopperGold
  [GrapheneLattice-TealGold]=GrapheneLattice_TealGold
  [GrapheneLattice-BlueSilver]=GrapheneLattice_BlueSilver
)
COMPS=("$@")
[ ${#COMPS[@]} -eq 0 ] && COMPS=(DataGridSpace-Blue ParticleOrb-VioletBlue ParticleOrb-TealGold CellCluster-MicroscopeBlue PillarField-BlueViolet PillarField-CopperGold GrapheneLattice-TealGold GrapheneLattice-BlueSilver)
mkdir -p out/frames out/previews out/stills
for c in "${COMPS[@]}"; do
  f=${FILE[$c]}
  rm -rf out/frames/$f
  t0=$(date +%s.%N)
  npx remotion render $BUNDLE $c out/frames/$f --sequence --image-format=png --scale=0.3333333333333333 --concurrency=1 > out/frames/$f.log 2>&1
  rc=$?
  t1=$(date +%s.%N)
  n=$(ls out/frames/$f/*.png 2>/dev/null | wc -l)
  python3 -c "print('RENDER $c rc=$rc frames=$n wall=%.1fs perframe=%.3fs' % ($t1-$t0, ($t1-$t0)/max($n,1)))"
  first=$(ls out/frames/$f/*.png | head -1); pat=$(echo "$first" | sed -E 's/[0-9]+\.png$/%03d.png/')
  ffmpeg -v error -y -framerate 30 -start_number 0 -i "$pat" -c:v libx264 -preset slow -crf 16 -pix_fmt yuv420p -r 30 -an -movflags +faststart out/previews/$f.mp4
  echo "ENCODED $c $(ffprobe -v error -show_entries stream=width,height -of csv=p=0 out/previews/$f.mp4)"
  cp "$(echo "$pat" | sed 's/%03d/300/')" out/stills/$f.png
done
echo ALLDONE
