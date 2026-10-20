#!/usr/bin/env bash
# ffprobe every preview: 1280x720, 30/1, h264, yuv420p, no audio, 20.0 s or 12.0 s.
cd "$(dirname "$0")/../renders" || exit 1
for f in Painted_*.mp4; do
  v=$(ffprobe -v error -select_streams v:0 -show_entries stream=codec_name,width,height,pix_fmt,r_frame_rate,nb_frames -of csv=p=0 "$f")
  a=$(ffprobe -v error -select_streams a -show_entries stream=index -of csv=p=0 "$f" | wc -l)
  d=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$f")
  case "$f" in *LakeLoop*) want=20.0;; *) want=12.0;; esac
  ok=PASS
  [[ "$v" == "h264,1280,720,yuv420p,30/1,"* ]] || ok=FAIL
  [[ "$a" == 0 ]] || ok=FAIL
  awk -v d="$d" -v w="$want" 'BEGIN{exit !(d>w-0.02 && d<w+0.02)}' || ok=FAIL
  echo "$ok  $f  [$v] audio_streams=$a duration=$d (want $want)"
done
