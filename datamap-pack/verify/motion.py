"""Step 6: 2 s around frame 300 (frames 270-330) of each encoded preview.
Reports per-frame mean absolute difference between consecutive frames
(steady values = steady motion; spikes = popping, pulsing or shimmer bursts)
and writes a strip of 6 consecutive full-size crops for visual stepping."""
import subprocess, os, glob
import numpy as np
from PIL import Image
os.makedirs("out/verify/motion", exist_ok=True)
for mp4 in sorted(glob.glob("out/previews/*.mp4")):
    name = os.path.basename(mp4)[:-4]
    d = f"out/verify/motion/{name}"
    os.makedirs(d, exist_ok=True)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", mp4, "-vf", "select=between(n\\,270\\,330)", "-fps_mode", "passthrough", f"{d}/f%03d.png"], check=True)
    files = sorted(glob.glob(f"{d}/f*.png"))
    arr = [np.asarray(Image.open(f).convert("L"), dtype=np.float32) for f in files]
    diffs = [float(np.mean(np.abs(arr[i] - arr[i - 1]))) for i in range(1, len(arr))]
    lum = [float(a.mean()) for a in arr]
    dd = np.array(diffs)
    print(f"{name:20s} frames={len(arr)} diff mean={dd.mean():.3f} min={dd.min():.3f} max={dd.max():.3f} max/median={dd.max()/np.median(dd):.2f} | mean-luma range {min(lum):.2f}-{max(lum):.2f}")
