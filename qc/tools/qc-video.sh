#!/usr/bin/env bash
# qc-video.sh <video.mp4> <reference.mp4> <expected_frames> : specs, duration, integrity
V="$1"; R="$2"; N="$3"
ffprobe -v error -select_streams v:0 -count_frames -show_entries stream=codec_name,width,height,pix_fmt,r_frame_rate,nb_read_frames -of csv=p=0 "$V"
echo "audio streams: $(ffprobe -v error -select_streams a -show_entries stream=index -of csv=p=0 "$V" | wc -l)"
D=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$V"); DR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$R")
python3 -c "d=$D; r=$DR; print(f'duration {d:.4f}s  reference {r:.4f}s  difference {abs(d-r)*1000:.1f} ms', 'PASS' if abs(d-r)<1/30 else 'FAIL')"
E=$(ffmpeg -v error -i "$V" -f null - 2>&1 | wc -l); echo "decode errors: $E"
echo "size: $(du -h "$V" | cut -f1)"
