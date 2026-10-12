#!/usr/bin/env bash
# Steps 1, 3, 4, 5 of the verify loop for one composition.
# usage: scripts/verify.sh <compId> <OutName> <bandX> <bandY>
set -uo pipefail
cd "$(dirname "$0")/.."
ID=$1; NAME=$2; BX=$3; BY=$4
MP4=out/previews/$NAME.mp4
echo "=== $ID"
echo "--- step 1: ffprobe"
ffprobe -v error -show_entries stream=codec_name,codec_type,width,height,r_frame_rate,pix_fmt \
  -show_entries format=duration -of default=noprint_wrappers=1 "$MP4"
echo "audio streams: $(ffprobe -v error -select_streams a -show_entries stream=index -of csv=p=0 "$MP4" | wc -l)"
echo "--- step 3: cold frame 300 vs frame 300 of the full render"
rm -rf out/cold/$ID
node scripts/stills.mjs "$ID" out/cold/$ID 0.3333333333333333 300 out/bundle 2>&1 | grep -E "^frame|rror"
SEQ300=$(ls out/keep/$ID/ | sed -n '16p')
if cmp -s "out/cold/$ID/${ID}_f0300.png" "out/keep/$ID/$SEQ300"; then echo "BYTE-IDENTICAL ($SEQ300)"; else
  python3 - "$ID" "$SEQ300" <<'PY'
import sys
from PIL import Image, ImageChops
a = Image.open(f"out/cold/{sys.argv[1]}/{sys.argv[1]}_f0300.png").convert("RGB")
b = Image.open(f"out/keep/{sys.argv[1]}/{sys.argv[2]}").convert("RGB")
print("bytes differ; pixel bbox of difference:", ImageChops.difference(a, b).getbbox())
PY
fi
echo "--- step 4: banding on a frame decoded from the mp4"
mkdir -p out/banding out/stills out/sheets
ffmpeg -v error -y -ss 10 -i "$MP4" -frames:v 1 out/banding/$NAME.png
python3 scripts/banding.py out/banding/$NAME.png "$BX" "$BY"
echo "--- step 5: contact sheet + still"
ffmpeg -v error -y -i "$MP4" -vf "select='eq(n\,0)+eq(n\,120)+eq(n\,240)+eq(n\,360)+eq(n\,480)',scale=640:360,tile=5x1" -frames:v 1 -vsync 0 out/sheets/$NAME.png
ffmpeg -v error -y -ss 10 -i "$MP4" -frames:v 1 out/stills/$NAME.png
