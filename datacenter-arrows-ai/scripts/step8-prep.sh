#!/usr/bin/env bash
# Prepares neutral image pairs (image1 = reference, image2 = ours) for the
# blind visual comparison. Usage: scripts/step8-prep.sh <outdir> [source]
# source = "still" (render a still) or a directory of preview mp4s.
set -euo pipefail
out=$1; src=${2:-still}
pair() { # name comp frame ref refSeconds mp4name
  local d="$out/$1"; mkdir -p "$d"
  ffmpeg -v error -y -ss "$5" -i "refs/$4.mp4" -frames:v 1 -vf "scale=1280:720:flags=lanczos" "$d/image1.png"
  if [ "$src" = "still" ]; then
    npx remotion still "$2" "$d/image2.png" --frame="$3" --scale=0.3333333333333333 --log=error
  else
    ffmpeg -v error -y -i "$src/$6.mp4" -vf "select=eq(n\,$3)" -frames:v 1 "$d/image2.png"
  fi
}
pair dc1a DataCenter-SideStreaks 200 1110765461 4.5 DataCenter_SideStreaks
pair dc1b DataCenter-AisleFibres 200 1110765471 8.5 DataCenter_AisleFibres
pair arrows RisingArrows-Blue 300 3426619999 10 RisingArrows_Blue
pair padlock PadlockGrid 300 3915105519 7.5 PadlockGrid
pair cloud_mid CloudHUD 285 3424975687 6.5 CloudHUD
pair cloud_end CloudHUD 440 3424975687 10.6 CloudHUD
pair cube_mid AICube-Blue 150 3530248167 2.0 AICube_Blue
pair cube_end AICube-Blue 350 3530248167 9.5 AICube_Blue
