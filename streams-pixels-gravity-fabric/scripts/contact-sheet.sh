#!/usr/bin/env bash
# Step 5: five evenly spaced frames (0,120,240,360,480) from the mp4 in a row.
set -euo pipefail
f="$1"; out="$2"
ffmpeg -v error -y -i "$f" -vf "select='not(mod(n\,120))',scale=384:216,tile=5x1" -frames:v 1 -fps_mode vfr "$out"
