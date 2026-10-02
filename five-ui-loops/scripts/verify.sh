#!/usr/bin/env bash
# Verify loop steps 1, 3, 5 for one composition: file checks, cold-start frame
# 150 vs the full render (byte for byte), five evenly spaced frames.
set -euo pipefail
cd "$(dirname "$0")/.."
id=$1; name=$2; GL="${GL:-angle}"
f=out/previews/$name.mp4
mkdir -p out/verify/$id
echo "== $id"
ffprobe -v error -show_entries stream=codec_type,codec_name,width,height,r_frame_rate,pix_fmt \
  -show_entries format=duration -of default=noprint_wrappers=1 "$f" | tr '\n' ' '; echo
echo "audio streams: $(ffprobe -v error -select_streams a -show_entries stream=index -of csv=p=0 "$f" | wc -l)"
# Step 3: cold single-frame render vs frame 150 of the full sequence
npx remotion still "$id" out/verify/$id/cold150.png --frame=150 --scale=0.5 --gl="$GL" --log=error
if cmp -s out/verify/$id/cold150.png out/frames/$id/element-150.png; then echo "frame150: BYTE-IDENTICAL"; else
  echo "frame150: bytes differ"; python3 scripts/pxdiff.py out/verify/$id/cold150.png out/frames/$id/element-150.png; fi
# Step 5: five evenly spaced frames from the encoded mp4
n=$(ffprobe -v error -count_frames -select_streams v -show_entries stream=nb_read_frames -of csv=p=0 "$f")
echo "frames in mp4: $n"
for k in 0 1 2 3 4; do fr=$(( (n-1)*k/4 )); ffmpeg -v error -y -i "$f" -vf "select=eq(n\,$fr)" -frames:v 1 out/verify/$id/mp4_$fr.png; done
ffmpeg -v error -y $(for p in $(ls out/verify/$id/mp4_*.png | sort -t_ -k2 -n); do echo -i $p; done) \
  -filter_complex "$(for k in 0 1 2 3 4; do echo -n "[$k]scale=640:-1[v$k];"; done)[v0][v1][v2][v3][v4]hstack=5" out/verify/$id/sheet.png
echo "sheet: out/verify/$id/sheet.png"
