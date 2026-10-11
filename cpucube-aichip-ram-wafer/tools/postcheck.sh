#!/bin/bash
# After tools/render-previews.sh: file checks, determinism (cold frame 300), contact sheets,
# 720p stills, motion metrics. Usage: bash tools/postcheck.sh [ids...]
cd "$(dirname "$0")/.."
IDS=${@:-$(cat tools/all.txt)}
mkdir -p renders/stills renders/sheets out/cold
for id in $IDS; do
  name=${id/-/_}
  f="renders/$name.mp4"
  echo "== $id"
  ffprobe -v error -show_entries stream=codec_name,codec_type,width,height,r_frame_rate,pix_fmt -show_entries format=duration -of compact=p=0:nk=0 "$f"
  # determinism: frame 300 alone from a cold start vs frame 300 of the full render
  node tools/stills.mjs "$id" out/cold 0.3333333333333333 300 2>&1 | grep -iE "error" 
  if cmp -s "out/cold/${id}_0300.png" "renders/frames/$id/element-300.png"; then echo "determinism: BYTE-IDENTICAL"; else echo -n "determinism: bytes differ; pixels: "; python3 tools/compare.py "out/cold/${id}_0300.png" "renders/frames/$id/element-300.png"; fi
  cp "renders/frames/$id/element-300.png" "renders/stills/${name}.png"
  ffmpeg -v error -y -i "$f" -vf "select='eq(n\,0)+eq(n\,120)+eq(n\,240)+eq(n\,360)+eq(n\,480)',scale=640:-1,tile=5x1" -frames:v 1 "renders/sheets/${name}_sheet.png"
done
