#!/usr/bin/env bash
# Verification helpers for the 720p previews (see README "Verification").
#   scripts/verify.sh probe <file.mp4> <expected-seconds>
#   scripts/verify.sh still <CompositionId> <frame> <out.png> [--props=...]   (cold-start single frame)
#   scripts/verify.sh same <a.png> <b.png>          byte + pixel comparison
#   scripts/verify.sh sheet <file.mp4> <out.png>    5 evenly spaced frames in a row
#   scripts/verify.sh frame <file.mp4> <frame> <out.png>   frame from the encoded mp4
set -euo pipefail
GL=${GL:-angle}
cmd=$1; shift
case "$cmd" in
  probe)
    f=$1; want=$2
    out=$(ffprobe -v error -show_entries stream=codec_type,codec_name,width,height,r_frame_rate,pix_fmt -show_entries format=duration -of default=noprint_wrappers=1 "$f")
    echo "$out"
    ok=1
    grep -q "codec_name=h264" <<<"$out" || ok=0
    grep -q "width=1280" <<<"$out" || ok=0
    grep -q "height=720" <<<"$out" || ok=0
    grep -q "r_frame_rate=30/1" <<<"$out" || ok=0
    grep -q "pix_fmt=yuv420p" <<<"$out" || ok=0
    grep -q "codec_type=audio" <<<"$out" && ok=0
    dur=$(grep duration= <<<"$out" | cut -d= -f2)
    awk -v d="$dur" -v w="$want" 'BEGIN{exit !(d >= w - 0.02 && d <= w + 0.02)}' || ok=0
    [ $ok = 1 ] && echo "PROBE PASS $f" || { echo "PROBE FAIL $f"; exit 1; }
    ;;
  still)
    comp=$1; frame=$2; out=$3; shift 3
    args=(--frame="$frame" --scale=0.3333333333333333 --gl="$GL" --image-format=png --timeout=240000)
    [ -n "${CHROME:-}" ] && args+=(--browser-executable="$CHROME")
    npx remotion still ${BUNDLE:-src/index.ts} "$comp" "$out" "${args[@]}" "$@" > /dev/null
    ;;
  same)
    a=$1; b=$2
    if cmp -s "$a" "$b"; then echo "IDENTICAL (bytes) $a $b"; exit 0; fi
    ha=$(ffmpeg -v error -i "$a" -f rawvideo -pix_fmt rgba - | md5sum | cut -c1-32)
    hb=$(ffmpeg -v error -i "$b" -f rawvideo -pix_fmt rgba - | md5sum | cut -c1-32)
    if [ "$ha" = "$hb" ]; then echo "IDENTICAL (pixels; png bytes differ) $a $b"; exit 0; fi
    echo "DIFFERENT $a $b"
    ffmpeg -v error -i "$a" -i "$b" -filter_complex "blend=all_mode=difference,signalstats" -f null - 2>&1 | tail -1 || true
    exit 1
    ;;
  sheet)
    f=$1; out=$2
    n=$(ffprobe -v error -count_packets -select_streams v:0 -show_entries stream=nb_read_packets -of csv=p=0 "$f")
    sel=""
    for k in 0 1 2 3 4; do idx=$(( (n - 1) * k / 4 )); sel+="eq(n\\,$idx)+"; done
    ffmpeg -v error -y -i "$f" -vf "select='${sel%+}',scale=640:-1,tile=5x1" -frames:v 1 -vsync vfr "$out"
    ;;
  frame)
    f=$1; k=$2; out=$3
    ffmpeg -v error -y -i "$f" -vf "select=eq(n\\,$k)" -frames:v 1 -vsync vfr "$out"
    ;;
  *) echo "unknown command $cmd"; exit 2 ;;
esac
