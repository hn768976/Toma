"""Banding check on an encoded mp4 (not the preview).

Extracts one frame from the mp4 as PNG and reads pixel values along a
horizontal band of background. Each 1-px column is averaged over the band's
rows, after rejecting pixels that belong to objects, which averages the grain
away.

Grain and dither are added after 8-bit quantisation, so a banded gradient
(a staircase) averages to values sitting on whole codes. A smooth gradient
averages to fractional values spread evenly between codes. The test measures
how strongly the column means cluster on whole codes: about 1 means a
staircase, about 0 means smooth. As a control, the same profile is rounded to
whole codes, simulating a banded gradient, and must score high.

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
y0, y1 = (int(sys.argv[3]), int(sys.argv[4])) if len(sys.argv) > 4 else (0, 120)
band = a[y0:y1]
print(f'frame at {t}s, {w}x{h}, band rows {y0}-{y1}')
print('raw pixels, row', y0, 'x=0..15 (G):', band[0, :16, 1].astype(int).tolist())

# per-column mean with object rejection
prof = np.zeros((w, 3))
for x in range(w):
    col = band[:, x]
    lum = col.mean(1)
    med = np.median(lum)
    keep = col[np.abs(lum - med) < 8]
    prof[x] = keep.mean(0) if len(keep) > 10 else np.nan
ok = ~np.isnan(prof[:, 0])
xs = np.arange(w)
prof = np.stack([np.interp(xs, xs[ok], prof[ok, c]) for c in range(3)], 1)


def clustering(v):
    """|mean of e^(2*pi*i*v)|: ~1 when column means sit on whole codes
    (staircase), ~0 when they are spread evenly (smooth gradient)."""
    return float(np.abs(np.exp(2j * np.pi * v).mean()))


print('profile (every 128 px, R G B):')
for x in range(0, w, 128):
    print(f'  x={x:5d}  ' + '  '.join(f'{v:7.2f}' for v in prof[x]))

# Only channels that are away from the 255 clip and sweep >= 4 codes.
scores, controls = [], []
rng = np.random.default_rng(0)
for c, name in enumerate('RGB'):
    v = prof[:, c]
    if v.max() > 250 or v.max() - v.min() < 4:
        print(f'{name}: skipped (near 255 or < 4 codes of gradient)')
        continue
    sc = clustering(v)
    # control: same gradient banded on purpose, then the same grain averaging
    ctrl = np.round(v) + rng.normal(0, 0.12, v.shape)
    cc = clustering(ctrl)
    scores.append(sc)
    controls.append(cc)
    print(f'{name}: sweep {v.min():.1f}-{v.max():.1f}, whole-code clustering {sc:.3f} '
          f'(banded control {cc:.3f})')

banded = any(sc > 0.3 for sc in scores)
print('BANDING: ' + ('SUSPECT' if banded else 'none detected (smooth)'))
