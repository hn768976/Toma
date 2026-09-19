#!/usr/bin/env bash
# Produces a send-friendly copy of a rendered master.
#
# Two jobs. First, size: the masters are CRF 17 and the 20s shot lands around
# 40MB, over the 30MB transfer limit. Second, colour range: Remotion encodes
# from full-range JPEG frames and tags the result yuvj420p, while the reference
# plates -- and what an NLE expects -- are limited-range yuv420p. Players that
# ignore the tag show crushed blacks, so the range is converted properly here
# rather than just relabelled.
set -euo pipefail
cd "$(dirname "$0")/.."

SRC="$1"
DST="out/delivery/$(basename "${SRC%.mp4}").mp4"
CRF="${2:-21}"

npx remotion ffmpeg -i "$SRC" \
  -vf "scale=in_range=full:out_range=limited" \
  -c:v libx264 -crf "$CRF" -preset slow \
  -pix_fmt yuv420p -color_range tv \
  -colorspace bt709 -color_primaries bt709 -color_trc bt709 \
  -movflags +faststart -an \
  "$DST" -y >/dev/null 2>&1

echo "$(basename "$DST")  $(du -h "$DST" | cut -f1)  (master $(du -h "$SRC" | cut -f1))"
