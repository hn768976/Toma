"""Banding check on a frame decoded from the encoded mp4.
For each listed gradient row: longest run of identical raw values (8-bit plateaus
are the signature of banding), and the largest step in the 9-row mean profile
after removing the smooth trend (a staircase shows up as residual jumps)."""
import sys, subprocess
import numpy as np
from PIL import Image

REGIONS = {  # name: list of (y_frac, x0_frac, x1_frac)
    "DataCube_Blue": [(0.08, 0.0, 1.0), (0.5, 0.0, 0.32), (0.9, 0.0, 1.0)],
    "CloudMap_Story": [(0.06, 0.0, 1.0), (0.15, 0.0, 1.0)],
    "ChromePortal_Silver": [(0.5, 0.40, 0.60), (0.35, 0.42, 0.58)],
    "ChromePortal_Gold": [(0.5, 0.40, 0.60), (0.35, 0.42, 0.58)],
    "GoldRibbonPodium_RedGold": [(0.12, 0.3, 1.0), (0.55, 0.0, 1.0), (0.95, 0.0, 1.0)],
    "GoldRibbonPodium_EmeraldGold": [(0.12, 0.3, 1.0), (0.55, 0.0, 1.0), (0.95, 0.0, 1.0)],
    "SoftLight_Blue": [(0.1, 0.0, 1.0), (0.5, 0.0, 1.0), (0.85, 0.0, 1.0)],
    "SoftLight_Violet": [(0.1, 0.0, 1.0), (0.5, 0.0, 1.0), (0.85, 0.0, 1.0)],
}
name, frame = sys.argv[1], int(sys.argv[2])
src = f"out/previews/{name}.mp4"
png = f"out/verify/{name}_band_frame{frame}.png"
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", src, "-vf", f"select=eq(n\\,{frame})", "-frames:v", "1", png], check=True)
im = np.asarray(Image.open(png).convert("RGB")).astype(float)
H, W, _ = im.shape
def box(x, k):
    return np.convolve(np.pad(x, k // 2, mode="edge"), np.ones(k) / k, mode="valid")
ok = True
for yf, x0, x1 in REGIONS[name]:
    y = int(yf * (H - 1)); a = int(x0 * (W - 1)); b = int(x1 * (W - 1))
    row = im[y, a:b]
    worst_run = 0
    for c in range(3):
        v = row[:, c]; run = 1; best = 1
        for i in range(1, len(v)):
            run = run + 1 if v[i] == v[i - 1] else 1; best = max(best, run)
        worst_run = max(worst_run, best)
    strip = im[max(0, y - 4):y + 5, a:b].mean(axis=0).mean(axis=-1)
    fine = box(strip, 3); trend = box(strip, 61)
    resid = (fine - trend)[30:-30]
    step = np.abs(np.diff(fine))[30:-30].max()
    r0, r1 = row[0].astype(int).tolist(), row[-1].astype(int).tolist()
    verdict = "smooth" if worst_run < 24 and step < 2.0 else "CHECK"
    ok &= verdict == "smooth"
    print(f"  y={yf:.2f} x={x0:.2f}-{x1:.2f}  rgb {r0}->{r1}  longest-flat-run={worst_run}px  max-step(9-row mean)={step:.2f}  resid-std={resid.std():.2f}  {verdict}")
print(f"{name}: {'PASS' if ok else 'CHECK'}")
