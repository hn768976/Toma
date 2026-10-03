#!/usr/bin/env bash
# 720p previews: Remotion renders a lossless PNG sequence at --scale=1/3
# (3840x2160 -> 1280x720), ffmpeg encodes it to H.264 / yuv420p / CRF 16 /
# 30 fps with no audio. The PNG frames are kept so any single frame can be
# compared byte-for-byte with a cold `remotion still` (determinism check).
# Usage: scripts/render-previews.sh [compId ...]   (default: all 8)
set -euo pipefail
OUT=${OUT:-renders}
SCALE=0.3333333333333333
ALL=(DataCenter-SideStreaks DataCenter-AisleFibres RisingArrows-Blue RisingArrows-Green PadlockGrid CloudHUD AICube-Blue AICube-Violet)
[ $# -gt 0 ] && COMPS=("$@") || COMPS=("${ALL[@]}")
mkdir -p "$OUT/frames"
for comp in "${COMPS[@]}"; do
  name=${comp//-/_}
  dir="$OUT/frames/$name"
  rm -rf "$dir"
  start=$(date +%s.%N)
  npx remotion render "$comp" "$dir" --sequence --image-format=png --scale=$SCALE --concurrency=1 --log=error
  end=$(date +%s.%N)
  n=$(ls "$dir" | wc -l)
  per=$(python3 -c "print(f'{($end-$start)/$n:.3f}')")
  echo "$comp frames=$n total_s=$(python3 -c "print(f'{$end-$start:.1f}')") s_per_frame=$per" | tee -a "$OUT/timings.txt"
  first=$(ls "$dir" | head -1)
  pattern=$(echo "$first" | sed -E 's/[0-9]+\.png$//')
  digits=$(echo "$first" | sed -E 's/.*[^0-9]([0-9]+)\.png$/\1/' | tr -d '\n' | wc -c)
  ffmpeg -v error -y -framerate 30 -i "$dir/${pattern}%0${digits}d.png" \
    -vf "scale=out_color_matrix=bt709:out_range=tv" -colorspace bt709 -color_primaries bt709 -color_trc bt709 \
    -c:v libx264 -preset slow -crf 16 -pix_fmt yuv420p -r 30 -an -movflags +faststart "$OUT/$name.mp4"
done
