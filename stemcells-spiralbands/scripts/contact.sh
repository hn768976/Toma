#!/usr/bin/env bash
# Contact sheet of N evenly spaced frames from an mp4: contact.sh in.mp4 N out.png
set -euo pipefail
in=$1; n=$2; out=$3
dur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$in")
tmp=$(mktemp -d)
for i in $(seq 0 $((n-1))); do
  t=$(python3 -c "print(($i+0.5)*$dur/$n)")
  ffmpeg -v error -y -ss "$t" -i "$in" -frames:v 1 -vf "scale=640:-1,drawtext=text='%{pts\:hms}':x=8:y=8:fontcolor=white:box=1:boxcolor=black@0.5" "$tmp/$i.png" 2>/dev/null \
   || ffmpeg -v error -y -ss "$t" -i "$in" -frames:v 1 -vf scale=640:-1 "$tmp/$i.png"
done
cols=4; [ "$n" -le 5 ] && cols=$n
ffmpeg -v error -y -pattern_type glob -i "$tmp/*.png" -vf "tile=${cols}x$(( (n+cols-1)/cols ))" -frames:v 1 "$out" 2>/dev/null || \
python3 - "$tmp" "$n" "$cols" "$out" <<'PY'
import sys,os
from PIL import Image
d,n,c,o=sys.argv[1],int(sys.argv[2]),int(sys.argv[3]),sys.argv[4]
ims=[Image.open(f"{d}/{i}.png") for i in range(n)]
w,h=ims[0].size; r=(n+c-1)//c
sheet=Image.new("RGB",(w*c,h*r))
for i,im in enumerate(ims): sheet.paste(im,((i%c)*w,(i//c)*h))
sheet.save(o)
PY
rm -rf "$tmp"
