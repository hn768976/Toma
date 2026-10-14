#!/usr/bin/env bash
# Step 5 — contact sheets from the encoded previews (8 frames for stories, 5 for the loop).
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p out/checks
sheet() { # name n_frames duration
  local f=out/previews/$1.mp4 n=$2 d=$3 i=0 args=() filt=""
  for k in $(seq 0 $((n-1))); do
    t=$(echo "scale=3; $d * ($k + 0.5) / $n" | bc)
    args+=(-ss "$t" -i "$f"); filt+="[$k:v]scale=480:-1,drawtext=text='t=${t}s':x=8:y=8:fontsize=18:fontcolor=white:box=1:boxcolor=black@0.5[v$k];"
  done
  local cols=4; [ "$n" = 5 ] && cols=5
  local ins=""; for k in $(seq 0 $((n-1))); do ins+="[v$k]"; done
  ffmpeg -v error -y "${args[@]}" -frames:v 1 -filter_complex "${filt}${ins}xstack=inputs=$n:layout=$(python3 -c "
n=$n;c=$cols
print('|'.join(f'{(i%c)*480}_{(i//c)*270}' for i in range(n)))")" out/checks/sheet_$1.png
}
sheet AIHudPlane_Violet 8 15; sheet AIHudPlane_Teal 8 15
sheet ParticleAIChip_Blue 5 20
sheet AIChipReveal_Blue 8 10; sheet AIChipReveal_Amber 8 10
ls out/checks/sheet_*
