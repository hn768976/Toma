"""Banding check on an encoded mp4 (not the preview).

Extracts one frame from the mp4 as PNG, then reads pixel values along a
horizontal band of background. Each sample averages a tall column of pixels
(which averages out the grain) after rejecting outliers (objects). A clean
gradient gives a smooth profile; banding shows up as flat runs separated by
whole-code steps.

usage: python3 scripts/banding_check.py video.mp4 [time_s] [y0 y1]
"""
import subprocess
import sys
import tempfile

import numpy as np
from PIL import Image

video = sys.argv[1]
t = float(sys.argv[2]) if len(sys.argv) > 2 else 10.0
png = tempfile.mktemp(suffix='.png')
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', str(t), '-i', video,
                '-frames:v', '1', png], check=True)
a = np.asarray(Image.open(png).convert('RGB')).astype(float)
h, w, _ = a.shape
y0, y1 = (int(sys.argv[3]), int(sys.argv[4])) if len(sys.argv) > 4 else (0, h // 12)
band = a[y0:y1]
# raw single-row values (what a viewer sees): show grain + dither are present
row = band[0]
print(f'frame {png} {w}x{h}, band rows {y0}-{y1}')
print('raw row, first 16 px (R):', row[:16, 0].astype(int).tolist())
prof = []
for x in range(0, w, 4):
    col = band[:, x:x + 4].reshape(-1, 3)
    lum = col.mean(1)
    med = np.median(lum)
    keep = col[np.abs(lum - med) < 6]  # reject objects crossing the band
    prof.append(keep.mean(0) if len(keep) else col.mean(0))
prof = np.array(prof)
# smooth lightly (grain averages to ~0.1 code over the column)
k = np.ones(5) / 5
sm = np.stack([np.convolve(prof[:, c], k, mode='valid') for c in range(3)], 1)
d = np.diff(sm, axis=0)
print('profile (every 64 px, R G B):')
for i in range(0, len(sm), 16):
    print(f'  x={i * 4 + 8:5d}  ' + '  '.join(f'{v:7.2f}' for v in sm[i]))
print('max |step| between neighbouring 4-px samples: R %.2f G %.2f B %.2f codes'
      % tuple(np.abs(d).max(0)))
# a staircase would show many ~0 steps and occasional ~1-code jumps
jumps = (np.abs(d) > 0.75).sum()
print('steps > 0.75 code:', int(jumps))
print('BANDING: ' + ('SUSPECT' if jumps > 0 else 'none detected (smooth)'))
