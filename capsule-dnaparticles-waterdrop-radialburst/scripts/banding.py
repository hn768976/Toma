#!/usr/bin/env python3
"""Step 4 banding check on frames decoded from the encoded mp4s.

For each composition, sample lines across its flat/gradient background areas.
Reports per line:
  - longest run of identical 8-bit values along a single pixel row (flat
    plateaus are what banding looks like; dithered/grained gradients have
    none longer than a few px),
  - largest jump between neighbouring 8-px block means of a 16-row strip
    (a band edge shows as a jump of >= ~1 level in an otherwise smooth ramp),
  - start/end mean value, so the ramp itself is visible.
"""
import subprocess, sys, json
import numpy as np
from PIL import Image

AREAS = {
    'CapsuleRelease_White':  [('row', 690, 0, 1280), ('row', 30, 0, 1280), ('col', 1265, 0, 720)],
    'CapsuleRelease_TwoTone':[('row', 690, 0, 1280), ('row', 30, 0, 1280), ('col', 1265, 0, 720)],
    'DNAParticles_Violet':   [('row', 360, 700, 1280), ('row', 650, 700, 1280), ('col', 1200, 0, 720)],
    'DNAForm_Teal':          [('row', 360, 700, 1280), ('row', 650, 700, 1280), ('col', 1200, 0, 720)],
    'DNAParticles_Teal':     [('row', 360, 700, 1280), ('row', 650, 700, 1280), ('col', 1200, 0, 720)],
    'WaterDrop_Blue':        [('row', 30, 0, 1280), ('row', 690, 0, 1280), ('col', 1250, 0, 720), ('col', 60, 0, 720)],
    'RadialBurst_Navy':      [('row', 120, 700, 1280), ('row', 600, 700, 1280), ('col', 1220, 0, 720)],
    'RadialBurst_TealGold':  [('row', 120, 0, 580), ('row', 600, 0, 580), ('col', 60, 0, 720)],
}

def frame(path, t):
    out = path.replace('.mp4', f'_band_{t}.png')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', str(t), '-i', path, '-frames:v', '1', out], check=True)
    return np.asarray(Image.open(out).convert('RGB')).astype(float), out

def analyse(img, kind, pos, a, b):
    if kind == 'row':
        strip = img[max(pos - 8, 0):pos + 8, a:b]
        line = img[pos, a:b]
    else:
        strip = img[a:b, max(pos - 8, 0):pos + 8].transpose(1, 0, 2)
        line = img[a:b, pos]
    lum = line.mean(axis=1)
    # longest run of identical values, per channel, single pixel line
    runs = []
    for ch in range(3):
        v = line[:, ch]
        best = cur = 1
        for i in range(1, len(v)):
            cur = cur + 1 if v[i] == v[i - 1] else 1
            best = max(best, cur)
        runs.append(best)
    prof = strip.mean(axis=0).mean(axis=1)
    n = len(prof) // 8
    blocks = prof[: n * 8].reshape(n, 8).mean(axis=1)
    jumps = np.abs(np.diff(blocks))
    return {'line': f'{kind}{pos}[{a}:{b}]', 'longest_flat_run_px': max(runs),
            'max_block_jump': round(float(jumps.max()), 2), 'start': round(float(blocks[:2].mean()), 1),
            'end': round(float(blocks[-2:].mean()), 1)}

if __name__ == '__main__':
    d = sys.argv[1]
    for name, areas in AREAS.items():
        p = f'{d}/{name}.mp4'
        try:
            img, png = frame(p, float(sys.argv[2]) if len(sys.argv) > 2 else 6.0)
        except Exception as e:
            print(name, 'missing', e); continue
        for ar in areas:
            print(name, json.dumps(analyse(img, *ar)))
