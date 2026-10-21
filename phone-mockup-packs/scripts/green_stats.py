"""Deep-green statistics for a clip: share of pure-green-region pixels (>=8px
from any non-green pixel) within +-2 of (0,255,0), and the max deviation.
Usage: green_stats.py <mp4> [start] [count]"""
import subprocess, sys
import numpy as np
from scipy import ndimage
path = sys.argv[1]; start = int(sys.argv[2]) if len(sys.argv) > 2 else 0; count = int(sys.argv[3]) if len(sys.argv) > 3 else 100000
H, W = 720, 1280
DECODE = "scale=in_color_matrix=bt709:in_range=tv:flags=accurate_rnd+full_chroma_int,format=rgb24"
r = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-vf", f"select='gte(n\\,{start})',{DECODE}", "-vsync", "0",
                    "-frames:v", str(count), "-f", "rawvideo", "-"], capture_output=True, check=True)
fr = np.frombuffer(r.stdout, np.uint8).reshape(-1, H, W, 3).astype(np.int16)
tot = ok = worst = 0
for img in fr[::5]:
    dev = np.max(np.abs(img - np.array([0, 255, 0], np.int16)), axis=-1)
    deep = ndimage.binary_erosion(dev <= 40, iterations=8)
    d = dev[deep]
    tot += d.size; ok += int((d <= 2).sum()); worst = max(worst, int(d.max()) if d.size else 0)
print(f"{path}: frames={len(fr)} deep_px={tot} within2={ok/max(1,tot):.6f} max_dev={worst}")
