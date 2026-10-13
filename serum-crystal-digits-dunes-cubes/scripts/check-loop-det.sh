#!/bin/bash
# check-loop-det.sh <CompositionId> <PreviewName>
#  step 1: ffprobe;  step 2: loop (601-frame comp, frames 0 vs 600);
#  step 3: cold still of frame 300 vs frame 300 of the full render
ID=$1; NAME=$2
mkdir -p out/loop out/det out/contact
echo "== $ID"
ffprobe -v error -show_entries stream=codec_type,codec_name,width,height,r_frame_rate,pix_fmt \
  -show_entries format=duration -of default=noprint_wrappers=1 out/previews/$NAME.mp4 | tr '\n' ' '; echo
REMOTION_LOOP_FRAMES=601 npx remotion still $ID out/loop/$ID-0.png --frame=0 --scale=0.3333333333333333 --log=error
REMOTION_LOOP_FRAMES=601 npx remotion still $ID out/loop/$ID-600.png --frame=600 --scale=0.3333333333333333 --log=error
echo -n "loop 0 vs 600: "; python3 scripts/compare.py out/loop/$ID-0.png out/loop/$ID-600.png
npx remotion still $ID out/det/$ID-300.png --frame=300 --scale=0.3333333333333333 --log=error
echo -n "det frame 300: "; python3 scripts/compare.py out/det/$ID-300.png out/frames/$ID/element-300.png
scripts/contact.sh out/previews/$NAME.mp4 out/contact/$NAME.png
