#!/usr/bin/env bash
# Removes the silent audio track Remotion writes into an MP4 by default.
# Uses a stream copy, so the video is bit-identical and this takes ~1s a file.
# Also trims the container duration back to exactly the video length.
set -uo pipefail
cd "$(dirname "$0")/.."

DIR="${1:-out/1080p}"
FFMPEG="${FFMPEG:-ffmpeg}"

shopt -s nullglob
for f in "$DIR"/*.mp4; do
  tmp="${f%.mp4}.noaudio.mp4"
  if "$FFMPEG" -v error -i "$f" -map 0:v -c:v copy -movflags +faststart -y "$tmp"; then
    mv "$tmp" "$f"
    echo "stripped audio: $(basename "$f")"
  else
    rm -f "$tmp"
    echo "FAILED: $(basename "$f")"
  fi
done
