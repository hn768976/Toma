#!/usr/bin/env bash
# Verification steps 1-6 for every version row. Writes out/verify/*.
set -uo pipefail
cd "$(dirname "$0")/.."
mkdir -p out/verify/loop out/verify/cold out/verify/sheets out/verify/motion out/verify/banding
ROWS=$(node -e '
const src = require("fs").readFileSync("src/versions.ts", "utf8");
const re = /id: "([^"]+)", file: "([^"]+)"/g; let m;
while ((m = re.exec(src))) console.log(m[1] + " " + m[2]);')
REPORT=out/verify/report.txt
: > "$REPORT"
while read -r ID STEM; do
  [ $# -gt 0 ] && [[ ! " $* " =~ " $ID " ]] && continue
  MP4="out/previews/$STEM.mp4"
  echo "== $ID" | tee -a "$REPORT"
  # Step 1: stream / format checks.
  P=$(ffprobe -v error -show_entries stream=codec_type,codec_name,width,height,r_frame_rate,pix_fmt -show_entries format=duration -of default=noprint_wrappers=1 "$MP4" < /dev/null | tr '\n' ' ')
  NA=$(ffprobe -v error -select_streams a -show_entries stream=index -of csv=p=0 "$MP4" < /dev/null | wc -l)
  echo "step1: $P audio_streams=$NA" | tee -a "$REPORT"
  # Step 2: loop check (601-frame variant, frames 0 and 600).
  npx remotion still "$ID" "out/verify/loop/${STEM}_0.png" --frame=0 --scale=0.3333333333333333 --props='{"loopCheck":true}' > /dev/null 2>&1 < /dev/null
  npx remotion still "$ID" "out/verify/loop/${STEM}_600.png" --frame=600 --scale=0.3333333333333333 --props='{"loopCheck":true}' > /dev/null 2>&1 < /dev/null
  python3 scripts/pixdiff.py "out/verify/loop/${STEM}_0.png" "out/verify/loop/${STEM}_600.png" "step2 loop 0 vs 600" | tee -a "$REPORT"
  # Step 3: frame 300 cold vs frame 300 of the full render (PNG sequence).
  npx remotion still "$ID" "out/verify/cold/${STEM}_300.png" --frame=300 --scale=0.3333333333333333 > /dev/null 2>&1 < /dev/null
  if cmp -s "out/verify/cold/${STEM}_300.png" "out/frames/$ID/element-300.png"; then echo "step3: frame 300 cold == full render: BYTE-IDENTICAL" | tee -a "$REPORT";
  else python3 scripts/pixdiff.py "out/verify/cold/${STEM}_300.png" "out/frames/$ID/element-300.png" "step3 (not byte-identical)" | tee -a "$REPORT"; fi
  # Step 5: contact sheet, five evenly spaced frames from the mp4.
  ffmpeg -v error -y -i "$MP4" -vf "select='eq(n\,0)+eq(n\,120)+eq(n\,240)+eq(n\,360)+eq(n\,480)',scale=384:216,tile=5x1" -frames:v 1 -vsync 0 "out/verify/sheets/$STEM.png" < /dev/null
  # Step 6: frames 285-314 (1 s) around frame 300, decoded from the mp4.
  rm -rf "out/verify/motion/$STEM"; mkdir -p "out/verify/motion/$STEM"
  ffmpeg -v error -y -i "$MP4" -vf "select='between(n\,285\,314)'" -vsync 0 "out/verify/motion/$STEM/f%02d.png" < /dev/null
  # Step 4: banding probe on a frame decoded from the mp4.
  ffmpeg -v error -y -i "$MP4" -vf "select='eq(n\,300)'" -vsync 0 -frames:v 1 "out/verify/banding/$STEM.png" < /dev/null
  python3 scripts/banding.py "out/verify/banding/$STEM.png" "$ID" | tee -a "$REPORT"
done <<< "$ROWS"
