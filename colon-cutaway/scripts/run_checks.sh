#!/usr/bin/env bash
# Verify loop (run after scripts/render_previews.sh). Writes to out/checks/.
#   1 ffprobe   3 loop (comp 2, frames 0 vs 600)   4 cold-start frame 300 vs full render
#   6 banding on the encoded mp4   7 five evenly spaced frames per comp   5 every 10th frame
set -uo pipefail
cd "$(dirname "$0")/.."
C=out/checks
mkdir -p "$C"
comps=(Colon-ConstipationRelief Colon-HealthyFlora Colon-InflammationRelief)

echo "== Step 1: ffprobe" | tee "$C/summary.txt"
for id in "${comps[@]}"; do
  f="out/${id/-/_}.mp4"
  echo "-- $f" | tee -a "$C/summary.txt"
  ffprobe -v error -show_entries stream=codec_type,codec_name,width,height,r_frame_rate,pix_fmt \
    -show_entries format=duration -of default=noprint_wrappers=1 "$f" | tee -a "$C/summary.txt"
  echo "audio streams: $(ffprobe -v error -select_streams a -show_entries stream=index -of csv=p=0 "$f" | wc -l)" | tee -a "$C/summary.txt"
done

echo "== Step 3: loop (Colon-HealthyFlora-601, frame 0 vs 600)" | tee -a "$C/summary.txt"
node scripts/stills.mjs Colon-HealthyFlora-601 "$C/loop" 0.5 0,600 > /dev/null 2>&1
python3 - "$C/loop/Colon-HealthyFlora-601_0000.png" "$C/loop/Colon-HealthyFlora-601_0600.png" <<'EOF' | tee -a "$C/summary.txt"
import sys, hashlib
import numpy as np
from PIL import Image
a, b = (np.asarray(Image.open(p).convert("RGBA")) for p in sys.argv[1:3])
d = np.abs(a.astype(int) - b.astype(int))
print("frame 0 vs 600: identical pixels =", bool((d == 0).all()), "| differing pixels:", int((d.max(-1) > 0).sum()), "| max diff:", int(d.max()))
print("md5:", *(hashlib.md5(open(p, "rb").read()).hexdigest() for p in sys.argv[1:3]))
EOF

echo "== Step 4: frame 300 cold start vs full render" | tee -a "$C/summary.txt"
for id in "${comps[@]}"; do
  npx remotion still "$id" "$C/${id}_300_cold.png" --frame=300 --scale=0.5 --image-format=png --log=error > /dev/null 2>&1
  full=$(ls out/frames/$id/*300.png | head -1)
  python3 - "$C/${id}_300_cold.png" "$full" "$id" <<'EOF' | tee -a "$C/summary.txt"
import sys, hashlib, filecmp
import numpy as np
from PIL import Image
a, b = (np.asarray(Image.open(p).convert("RGBA")) for p in sys.argv[1:3])
same_bytes = filecmp.cmp(sys.argv[1], sys.argv[2], shallow=False)
d = np.abs(a.astype(int) - b.astype(int))
print(f"{sys.argv[3]}: byte-identical PNG = {same_bytes} | pixel-identical = {bool((d == 0).all())} | max diff {int(d.max())}")
EOF
done

echo "== Step 6: banding (encoded mp4)" | tee -a "$C/summary.txt"
python3 scripts/check_banding.py out/Colon_ConstipationRelief.mp4 440 "$C/banding_c1.png" 0.5 0.0 0.3 | tee -a "$C/summary.txt"
python3 scripts/check_banding.py out/Colon_ConstipationRelief.mp4 40 "$C/banding_c1_lining.png" 0.5 0.36 0.62 0.02 0.65 0.10 0.90 | tee -a "$C/summary.txt"
python3 scripts/check_banding.py out/Colon_HealthyFlora.mp4 300 "$C/banding_c2.png" 0.5 0.0 0.3 | tee -a "$C/summary.txt"
python3 scripts/check_banding.py out/Colon_InflammationRelief.mp4 440 "$C/banding_c3.png" 0.5 0.72 1.0 | tee -a "$C/summary.txt"

echo "== Step 7: five evenly spaced frames per composition" | tee -a "$C/summary.txt"
for id in "${comps[@]}"; do
  f="out/${id/-/_}.mp4"
  n=$(ffprobe -v error -count_frames -select_streams v:0 -show_entries stream=nb_read_frames -of csv=p=0 "$f")
  sel=""
  for k in 0 1 2 3 4; do i=$(( k * (n - 1) / 4 )); sel="${sel}eq(n\\,$i)+"; done
  ffmpeg -v error -y -i "$f" -vf "select='${sel%+}',scale=640:-1,tile=5x1" -frames:v 1 "$C/${id}_5frames.png"
  ffmpeg -v error -y -i "$f" -vf "select='not(mod(n\\,10))',scale=384:-1,tile=6x8" -vsync vfr "$C/${id}_every10_%02d.png"
  echo "$id: $n frames -> ${id}_5frames.png, every-10th sheets" | tee -a "$C/summary.txt"
done
echo "done" | tee -a "$C/summary.txt"
