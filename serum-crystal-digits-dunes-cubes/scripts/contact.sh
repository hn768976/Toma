#!/bin/bash
# contact.sh video.mp4 out.png  -> five evenly spaced frames in a row
d=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$1")
args=(); f=""
for i in 0 1 2 3 4; do
  t=$(python3 -c "print(($i + 0.5) * $d / 5)")
  ffmpeg -v error -y -ss "$t" -i "$1" -frames:v 1 -vf scale=480:270 "/tmp/claude-0/cs_$i.png"
done
ffmpeg -v error -y -i /tmp/claude-0/cs_0.png -i /tmp/claude-0/cs_1.png -i /tmp/claude-0/cs_2.png -i /tmp/claude-0/cs_3.png -i /tmp/claude-0/cs_4.png -filter_complex hstack=5 "$2"
