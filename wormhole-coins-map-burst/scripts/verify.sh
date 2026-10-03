#!/usr/bin/env bash
# Verify loop: file checks, loop check, black check, determinism, banding samples.
set -uo pipefail
cd "$(dirname "$0")/.."
R=${OUT:-renders}; V=$R/verify; mkdir -p "$V"
SCALE=0.3333333333333333
echo "== Step 1: ffprobe"
for f in Wormhole_Violet Wormhole_CyanGold CoinGrowth HologramThreatMap SparkleBurst_Blue SparkleBurst_Gold; do
  echo "-- $f"; ffprobe -v error -show_entries stream=codec_type,codec_name,width,height,r_frame_rate,pix_fmt -show_entries format=duration -of default=noprint_wrappers=1 "$R/$f.mp4"
done
echo "== Step 2: loop check (601-frame variant, frame 0 vs 600)"
for c in Wormhole-Violet Wormhole-CyanGold HologramThreatMap; do
  npx remotion still $c "$V/${c}_0.png" --frame=0 --scale=$SCALE --props='{"loopCheck":true}' >/dev/null 2>&1
  npx remotion still $c "$V/${c}_600.png" --frame=600 --scale=$SCALE --props='{"loopCheck":true}' >/dev/null 2>&1
  python3 scripts/imgdiff.py "$V/${c}_0.png" "$V/${c}_600.png" "$c loop"
done
echo "== Step 3: black check (from encoded mp4)"
for f in SparkleBurst_Blue SparkleBurst_Gold; do
  ffmpeg -v error -y -i "$R/$f.mp4" -vf "select=eq(n\,0)" -frames:v 1 "$V/${f}_f0.png"
  ffmpeg -v error -y -i "$R/$f.mp4" -vf "select=eq(n\,345)" -frames:v 1 "$V/${f}_f345.png"
  python3 scripts/blackcheck.py "$V/${f}_f0.png" corners; python3 scripts/blackcheck.py "$V/${f}_f345.png" full
done
