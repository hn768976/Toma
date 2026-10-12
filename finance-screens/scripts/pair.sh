#!/usr/bin/env bash
# pair.sh <ref.png> <mine.png> <out.png> : side by side at 800px each
ffmpeg -v error -y -i "$1" -i "$2" -filter_complex "[0]scale=800:450[a];[1]scale=800:450[b];[a][b]hstack" "$3"
