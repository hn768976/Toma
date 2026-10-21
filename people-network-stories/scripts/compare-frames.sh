#!/bin/bash
# Extracts a reference frame and the matching preview frame (same point in the story) at the
# reference's size, for side-by-side checks. usage: scripts/compare-frames.sh
cd "$(dirname "$0")/.."
mkdir -p out/compare
# name refId seconds(our clip) ourLength
while read name ref t len; do
  rlen=$(ffprobe -v error -show_entries format=duration -of csv=p=0 refs/$ref.mp4)
  rt=$(echo "scale=3; $t * $rlen / $len" | bc)
  ffmpeg -v error -y -ss $rt -i refs/$ref.mp4 -frames:v 1 out/compare/${name}_ref.png
  ffmpeg -v error -y -ss $t -i out/previews/$name.mp4 -frames:v 1 -vf scale=596:336:flags=lanczos out/compare/${name}_ours.png
done <<LIST
BranchingTree_Red 2602325 26 30
PeopleLinkUp_Flip 2608517 10 30
SocialCluster_Red 2601677 14 20
PeopleWorldMap_Red 2602088 9 15
PeopleGrid_Cyan 2606141 16.5 25
PeopleBulb_White 2606192 18 24
CrowdPlatform_Blue 3158116 22 30
BigDataCrowd_Title 4856303 14 18
LIST
