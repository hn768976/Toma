#!/bin/bash
# usage: contact_sheet.sh in.mp4 out.png  -> five evenly spaced frames in a row
in=$1; out=$2
ffmpeg -v error -y -i "$in" -vf "select='eq(n\,0)+eq(n\,150)+eq(n\,300)+eq(n\,450)+eq(n\,599)',scale=480:-1,tile=5x1" -frames:v 1 -fps_mode passthrough "$out"
