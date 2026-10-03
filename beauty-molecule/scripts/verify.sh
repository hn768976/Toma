#!/bin/sh
# Verify loop: file checks, loop check (601 frames, 0 vs 600), cold-start
# determinism (frame 300 still vs frame 300 of a full PNG-sequence render),
# banding (from the encoded mp4), and five evenly spaced frames per comp.
cd "$(dirname "$0")/.."
SCALE=0.3333333333333333
OUT=out/verify
mkdir -p $OUT
for comp in ${COMPS:-DNA-Coral Structures-Coral DNA-Aqua Structures-Aqua}; do
  id="BeautyMolecule-$comp"
  name="BeautyMolecule_$(echo "$comp" | tr - _)"
  mp4="out/previews/$name.mp4"
  echo "=== $id"
  echo "--- step 1: ffprobe"
  ffprobe -v error -show_entries stream=codec_type,codec_name,width,height,r_frame_rate,pix_fmt \
    -show_entries format=duration -of default=noprint_wrappers=1 "$mp4"
  echo "audio streams: $(ffprobe -v error -select_streams a -show_entries stream=index -of csv=p=0 "$mp4" | wc -l)"
  echo "--- step 2: loop (601-frame mode, frame 0 vs 600)"
  npx remotion still "$id" $OUT/${name}_f0.png --frame=0 --props='{"loopCheck":true}' --scale=$SCALE --gl=angle --log=error
  npx remotion still "$id" $OUT/${name}_f600.png --frame=600 --props='{"loopCheck":true}' --scale=$SCALE --gl=angle --log=error
  cmp $OUT/${name}_f0.png $OUT/${name}_f600.png && echo "LOOP: identical" || echo "LOOP: DIFFERENT"
  echo "--- step 3: determinism (cold still vs full sequence render, frame 300)"
  rm -rf $OUT/seq_$name
  npx remotion render "$id" $OUT/seq_$name --sequence --image-format=png --scale=$SCALE --gl=angle --log=error
  npx remotion still "$id" $OUT/${name}_cold300.png --frame=300 --scale=$SCALE --gl=angle --log=error
  seqf=$(ls $OUT/seq_$name | sort | sed -n 301p)
  echo "sequence file: $seqf"
  cmp $OUT/seq_$name/$seqf $OUT/${name}_cold300.png && echo "DETERMINISM: byte-identical" || echo "DETERMINISM: DIFFERENT"
  rm -rf $OUT/seq_$name
  echo "--- step 4: banding (from mp4)"
  python3 scripts/banding_check.py "$mp4" 10
  echo "--- step 5: five frames"
  for t in 0 4 8 12 16; do
    ffmpeg -v error -y -ss $t -i "$mp4" -frames:v 1 $OUT/${name}_t$t.png
  done
done
