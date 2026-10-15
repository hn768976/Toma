#!/usr/bin/env python3
"""Step 6: frame-to-frame mean absolute difference over a whole preview.
A pop or flicker shows up as an isolated spike (a frame whose change is much
larger than its neighbours'). Prints median, max/median and spike frames."""
import subprocess, sys
import numpy as np
path = sys.argv[1]
w, h = 320, 180
raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-vf', f'scale={w}:{h}', '-f', 'rawvideo', '-pix_fmt', 'gray', '-'],
                     capture_output=True, check=True).stdout
fr = np.frombuffer(raw, np.uint8).reshape(-1, h, w).astype(np.float32)
d = np.abs(np.diff(fr, axis=0)).mean(axis=(1, 2))
med = np.median(d)
# local spike: change > 2.5x the mean of its 4 neighbours (and above noise)
spikes = []
for i in range(len(d)):
    nb = np.r_[d[max(0, i - 2):i], d[i + 1:i + 3]]
    if len(nb) and d[i] > 2.5 * nb.mean() and d[i] > 0.3:
        spikes.append((i + 1, round(float(d[i]), 3)))
print(f"{path.split('/')[-1]}: frames={len(fr)} median_change={med:.3f} max_change={d.max():.3f} at frame {int(d.argmax())+1}; spikes={spikes[:10]}")
