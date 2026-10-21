#!/bin/bash
# Renders the 720p previews (1280x720, H.264, yuv420p, CRF 16) into out/previews and logs
# the render time per frame. usage: scripts/render-previews.sh [Composition-Id ...]
cd "$(dirname "$0")/.."
mkdir -p out/previews
BROWSER_ARG=""
[ -n "$BROWSER" ] && BROWSER_ARG="--browser-executable=$BROWSER"
IDS=("$@")
[ ${#IDS[@]} -eq 0 ] && IDS=(BranchingTree-Red BranchingTree-Cyan PeopleLinkUp-Flip SocialCluster-Red SocialCluster-White PeopleWorldMap-Red PeopleWorldMap-Cyan PeopleGrid-Cyan PeopleBulb-White CrowdPlatform-Blue BigDataCrowd-Title BigDataCrowd-Clean)
for id in "${IDS[@]}"; do
  file="out/previews/${id/-/_}.mp4"
  start=$(date +%s.%N)
  npx remotion render src/index.ts "$id" "$file" --scale=0.3333333333333333 --gl=angle $BROWSER_ARG \
    --codec=h264 --crf=16 --pixel-format=yuv420p --color-space=bt709 --image-format=png --muted --log=error >/dev/null 2>out/previews/${id}.err || { echo "FAILED $id"; tail -5 out/previews/${id}.err; continue; }
  end=$(date +%s.%N)
  frames=$(ffprobe -v error -count_frames -select_streams v:0 -show_entries stream=nb_read_frames -of csv=p=0 "$file")
  echo "$id frames=$frames total=$(echo "$end - $start" | bc)s perframe=$(echo "scale=3; ($end - $start) / $frames" | bc)s" | tee -a out/previews/times.log
done
