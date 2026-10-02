#!/usr/bin/env bash
# Usage: scripts/sheet.sh <out.png> img1 img2 img3 img4  -> 2x2 contact sheet at 960px wide tiles
set -euo pipefail
O=$1; shift
ffmpeg -v error -y -i "$1" -i "$2" -i "$3" -i "$4" -filter_complex "[0]scale=960:-1[a];[1]scale=960:-1[b];[2]scale=960:-1[c];[3]scale=960:-1[d];[a][b]hstack[t];[c][d]hstack[u];[t][u]vstack" "$O"
