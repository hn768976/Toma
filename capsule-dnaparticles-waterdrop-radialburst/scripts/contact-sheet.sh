#!/usr/bin/env bash
# Step 5: one contact sheet per composition from the encoded preview
# (8 evenly spaced frames for 12 s stories, 5 for 20 s loops).
cd "$(dirname "$0")/.."
mkdir -p out/sheets
for f in out/previews/*.mp4; do
  n=$(basename "$f" .mp4)
  d=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$f")
  case $n in CapsuleRelease*|DNAForm*) k=8; tile=4x2;; *) k=5; tile=5x1;; esac
  ffmpeg -v error -y -i "$f" -vf "fps=$k/$d,scale=480:-1,drawtext=text='%{pts\:hms}':x=8:y=8:fontcolor=white:fontsize=18:box=1:boxcolor=black@0.5,tile=$tile" -frames:v 1 "out/sheets/$n.png" 2>/dev/null \
  || ffmpeg -v error -y -i "$f" -vf "fps=$k/$d,scale=480:-1,tile=$tile" -frames:v 1 "out/sheets/$n.png"
  echo "out/sheets/$n.png"
done
