#!/usr/bin/env bash
# Wait until out/previews/<stem>.mp4 is complete and newer than the given marker file.
cd "$(dirname "$0")/.."
until [ -f "out/previews/$1.mp4" ] && [ "out/previews/$1.mp4" -nt "$2" ] && ffprobe -v error "out/previews/$1.mp4" >/dev/null 2>&1 && [ -z "$(lsof "out/previews/$1.mp4" 2>/dev/null)" ]; do sleep 5; done
sleep 3
echo ready
