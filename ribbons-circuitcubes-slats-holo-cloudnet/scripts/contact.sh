#!/usr/bin/env bash
# Contact sheet (5 evenly spaced frames, decoded from the mp4) + a 2 s clip around frame 300.
set -euo pipefail
NAME="$1"; OUT=renders/checks; mkdir -p "$OUT"
ffmpeg -v error -y -i "renders/$NAME.mp4" -vf "select='not(mod(n\,120))',scale=384:-1,tile=5x1" -frames:v 1 "$OUT/${NAME}_contact.png"
ffmpeg -v error -y -ss 9 -t 2 -i "renders/$NAME.mp4" -c copy "$OUT/${NAME}_2s.mp4"
