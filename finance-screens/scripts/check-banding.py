#!/usr/bin/env python3
"""Step 4: banding check on frames decoded FROM THE ENCODED MP4.

For each file, decodes frame 300 to PNG, takes long pixel profiles through the
dark gradient areas (edge columns and top/bottom rows, where the vignette and
navy/black fall-off live), smooths them with a 9x9 box (removing grain/dither)
and looks for staircase steps: a run of >=24 px of a constant smoothed level
followed by a jump of >=2 levels. Smooth gradients have no such runs.
usage: python3 -I scripts/check-banding.py renders/*.mp4
"""
import subprocess, sys, json, os
import numpy as np
from PIL import Image

def box(a, k=9):
    c = np.cumsum(np.cumsum(np.pad(a, ((k, 0), (k, 0))), 0), 1)
    return (c[k:, k:] - c[:-k, k:] - c[k:, :-k] + c[:-k, :-k]) / (k * k)

def steps(p):
    q = np.round(p).astype(int)
    n, run, out = 0, 1, 0
    for i in range(1, len(q)):
        if q[i] == q[i - 1]:
            run += 1
        else:
            if run >= 24 and abs(q[i] - q[i - 1]) >= 2:
                out += 1
            run = 1
    return out

for f in sys.argv[1:]:
    png = f"out/banding/{os.path.basename(f)[:-4]}_300.png"
    os.makedirs("out/banding", exist_ok=True)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", f, "-vf", "select=eq(n\\,300)", "-frames:v", "1", png], check=True)
    img = np.asarray(Image.open(png).convert("L")).astype(float)
    H, W = img.shape
    sm = box(img)
    profs = {
        "col_x=4%": sm[:, int(W * 0.04)],
        "col_x=96%": sm[:, int(W * 0.96)],
        "row_y=4%": sm[int(H * 0.04), :],
        "row_y=96%": sm[int(H * 0.96), :],
        "diag": np.array([sm[int(i * (H - 9) / (W - 9)), i] for i in range(W - 9)]),
    }
    res = {"file": os.path.basename(f)}
    for k, p in profs.items():
        p = p[10:-10]
        d = np.diff(p)
        res[k] = {
            "samples": [int(round(x)) for x in p[:: max(1, len(p) // 8)]],
            "max_step": round(float(np.abs(d).max()), 2),
            "staircase_steps": steps(p),
        }
    res["pass"] = all(v["staircase_steps"] == 0 for k, v in res.items() if isinstance(v, dict))
    print(json.dumps(res))
