#!/usr/bin/env bash
# Steps 1-6 for one finished preview.  scripts/verify/verify-one.sh <CompId> <Name>
set -uo pipefail
ID="$1"; N="$2"; V=renders/verify; mkdir -p "$V/contact" "$V/motion"
F=renders/$N.mp4
echo "== $N"
# Step 1: file checks
ffprobe -v error -show_entries stream=codec_type,codec_name,width,height,r_frame_rate,pix_fmt \
  -show_entries format=duration -of default=noprint_wrappers=1 "$F" | tr '\n' ' '; echo
# Steps 2+3: loop + determinism (+ seam continuity)
scripts/verify/loop-determinism.sh "$ID" "$N" 2>&1 | tail -1
# Step 4: banding on a frame decoded from the encoded mp4
ffmpeg -v error -y -i "$F" -vf "select=eq(n\,300)" -frames:v 1 -vsync vfr "$V/mp4f300_$N.png"
case "$ID" in
  SummitPath-*)  L="0.30,0.02,0.30,0.40:halo_vertical 0.05,0.15,0.45,0.15:halo_horizontal 0.85,0.02,0.85,0.45:sky_right" ;;
  AIBrainChat-*) L="0.05,0.0,0.05,0.28:dark_top_left 0.95,0.0,0.95,0.28:dark_top_right" ;;
  BlackSilk-*)   L="0.5,0.0,0.5,1.0:vertical 0.0,0.8,1.0,0.8:low_valleys" ;;
  EarthGridRise-*) L="0.15,0.0,0.15,0.35:sky_left 0.85,0.0,0.85,0.35:sky_right 0.05,0.12,0.95,0.12:sky_horizontal" ;;
  LightTunnel-*) L="0.35,0.70,0.47,0.70:end_glow 0.5,0.05,0.5,0.4:ceiling" ;;
esac
python3 scripts/verify/banding.py "$V/mp4f300_$N.png" "$V/band" "$N" $L | grep -E "RESULT|\]"
# Step 5: contact sheet (frames 0,120,240,360,480)
scripts/verify/contact.sh "$F" "$V/contact/$N.png"
# Step 6: 2 s around frame 300 (frames 270..330), every 6th frame tiled for stepping
ffmpeg -v error -y -i "$F" -vf "select='between(n\,270\,330)*not(mod(n-270\,6))',scale=426:240,tile=4x3" -frames:v 1 -vsync vfr "$V/motion/$N.png"
