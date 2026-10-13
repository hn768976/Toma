#!/usr/bin/env bash
# Step 5: one contact sheet per composition, five evenly spaced frames in a row.
cd "$(dirname "$0")/.."
source scripts/ids.sh
mkdir -p out/contact
for id in ${*:-$ALL_IDS}; do
  ffmpeg -v error -y -i "out/previews/$(fname "$id").mp4" \
    -vf "select='eq(n\,0)+eq(n\,120)+eq(n\,240)+eq(n\,360)+eq(n\,480)',scale=512:288,tile=5x1" \
    -frames:v 1 "out/contact/$(fname "$id")_contact.png"
done
