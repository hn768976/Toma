#!/usr/bin/env bash
# Post-render checks for one composition (run after scripts/render-preview.sh):
#  1. ffprobe summary of the mp4
#  3. cold-start stills of frames 300 and 90 vs the same frames of the full render (byte compare)
#  4. banding: pixel rows across dark gradients/glow falloffs, read from the ENCODED mp4
#  5. contact sheet: 5 evenly spaced frames from the mp4
#  6. motion: frames 299/300/301 side by side + per-pixel temporal stats
#   scripts/verify.sh <CompositionId> <OutputName>
set -uo pipefail
ID=$1; NAME=$2; V=out/verify/$ID; mkdir -p "$V"
MP4=out/previews/$NAME.mp4; FR=out/frames/$ID
echo "== $ID"
ffprobe -v error -show_entries stream=codec_type,codec_name,width,height,r_frame_rate,pix_fmt \
  -show_entries format=duration -of compact=p=0 "$MP4"
echo "audio streams: $(ffprobe -v error -select_streams a -show_entries stream=index -of csv=p=0 "$MP4" | wc -l)"
# 3. determinism (each still runs in a fresh browser = cold start)
for f in 300 90; do
  node scripts/stills.mjs "$ID" "$V/cold" $f > /dev/null 2>&1
  p=$(printf "%03d" $f)
  if cmp -s "$V/cold/${ID}_$p.png" "$FR/element-$p.png"; then echo "frame $f: cold still == full render (byte-identical)";
  else echo -n "frame $f: DIFFERS → "; python3 scripts/imgdiff.py "$V/cold/${ID}_$p.png" "$FR/element-$p.png"; fi
done
# 4. banding from the encoded mp4
ffmpeg -v error -y -ss 12 -i "$MP4" -frames:v 1 "$V/mp4_frame360.png"
python3 scripts/banding.py "$V/mp4_frame360.png"
# 5. contact sheet
ffmpeg -v error -y -i "$MP4" -vf "select='eq(n\,60)+eq(n\,180)+eq(n\,300)+eq(n\,420)+eq(n\,540)',scale=384:-1,tile=5x1" -vsync 0 -frames:v 1 "$V/contact.png"
# 6. motion smoothness
ffmpeg -v error -y -i "$FR/element-299.png" -i "$FR/element-300.png" -i "$FR/element-301.png" -filter_complex hstack=3 "$V/f299_301.png"
python3 scripts/temporal.py "$FR/element-299.png" "$FR/element-300.png" "$FR/element-301.png"
