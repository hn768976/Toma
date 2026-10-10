#!/bin/bash
# Verification: loop (frame 0 == frame 600), determinism (cold still vs
# multi-threaded sequence render), contact sheets, per-frame timing.
# Usage: scripts/verify.sh [CompositionId ...]   (default: all 8)
set -u
cd "$(dirname "$0")/.."
SCALE=0.3333333333333333
OUT=out/verify
mkdir -p $OUT
IDS=${@:-PastelFabric-Iridescent PastelFabric-Champagne LockCubes-BlueOrange DataRings-FrontTilt DataRings-CloseAngle DataRings-LowHorizon DataRings-TopSpin DataRings-FrontTiltViolet}
EXE=/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell
BX=""; [ -x $EXE ] && BX="--browser-executable=$EXE"
rm -rf out/bundle && npx remotion bundle src/index.ts --out-dir=out/bundle >/dev/null 2>&1
for ID in $IDS; do
  D=$OUT/$ID; mkdir -p $D
  # 1. Loop check: 601-frame mode, frames 0 and 600.
  LOOP_CHECK=1 REUSE=1 node scripts/frames.mjs $ID $D/loop $SCALE 0,600 out/bundle >/dev/null 2>&1
  if cmp -s $D/loop/${ID}_f0000.png $D/loop/${ID}_f0600.png; then LOOPR=PASS; else LOOPR=FAIL; fi
  # 2. Determinism: frame 300 alone from a cold process vs from a multi-threaded sequence render.
  npx remotion still out/bundle $ID $D/cold_300.png --frame=300 --scale=$SCALE --gl=angle $BX >/dev/null 2>&1
  T0=$(date +%s.%N)
  npx remotion render out/bundle $ID $D/seq --sequence --image-format=png --frames=296-305 --concurrency=2 --scale=$SCALE --gl=angle $BX >/dev/null 2>&1
  T1=$(date +%s.%N)
  F300=$(ls $D/seq/*300.png 2>/dev/null | head -1)
  if [ -n "$F300" ] && cmp -s $D/cold_300.png "$F300"; then DETR=PASS; else DETR=FAIL; fi
  PERF=$(python3 -c "print(round(($T1-$T0)/10,2))")  # wall seconds per frame, 10 frames, concurrency 2, incl. startup
  # 3. Contact sheet: five evenly spaced frames.
  REUSE=1 node scripts/frames.mjs $ID $D/sheet $SCALE 0,120,240,360,480 out/bundle >/dev/null 2>&1
  ffmpeg -v error -y $(for f in 0000 0120 0240 0360 0480; do echo -i $D/sheet/${ID}_f$f.png; done) \
    -filter_complex "[0]scale=384:216[a];[1]scale=384:216[b];[2]scale=384:216[c];[3]scale=384:216[d];[4]scale=384:216[e];[a][b][c][d][e]hstack=5" $D/contact.png
  echo "$ID loop=$LOOPR determinism=$DETR wall_s_per_frame_c2=${PERF}s"
done
