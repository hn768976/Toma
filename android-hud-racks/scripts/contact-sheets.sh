#!/usr/bin/env bash
# Step 5: one contact sheet per preview, five evenly spaced frames in a row.
OUT=${1:-out}
mkdir -p "$OUT/contact"
for f in "$OUT"/*.mp4; do
  n=$(basename "$f" .mp4)
  d=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$f")
  args=(); filt=""
  for i in 0 1 2 3 4; do
    t=$(echo "$d * ($i + 0.5) / 5" | bc -l)
    args+=(-ss "$t" -i "$f")
    filt+="[$i:v]scale=480:270,drawtext=text='t=$(printf %.1f "$t")s':x=8:y=8:fontcolor=white:fontsize=16[v$i];"
  done
  ffmpeg -v error -y "${args[@]}" -frames:v 1 -filter_complex "${filt}[v0][v1][v2][v3][v4]hstack=inputs=5" "$OUT/contact/$n.png" 2>/dev/null \
    || ffmpeg -v error -y "${args[@]}" -frames:v 1 -filter_complex "$(echo "$filt" | sed 's/,drawtext[^[]*//g')[v0][v1][v2][v3][v4]hstack=inputs=5" "$OUT/contact/$n.png"
done
ls "$OUT/contact"
