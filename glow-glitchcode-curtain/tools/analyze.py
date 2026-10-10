#!/usr/bin/env python3
"""Banding / contact-sheet / motion checks on an encoded preview mp4.

usage: tools/analyze.py <preview.mp4> <outdir> <name>
 - banding: frames decoded FROM THE MP4; block-averaged (16x16, so grain averages out)
   horizontal and vertical profiles; reports the largest step between neighbouring
   blocks and the longest flat plateau in the gradient regions. Banding = a few big
   steps separated by plateaus; a smooth gradient = many +-1 steps.
 - contact sheet of 5 evenly spaced frames
 - motion: frames 270..330 (2 s around frame 300) mean abs frame-to-frame change.
"""
import subprocess, sys, os
import numpy as np
from PIL import Image

mp4, out, name = sys.argv[1:4]
os.makedirs(out, exist_ok=True)

def frames(idx):
    sel = "+".join(f"eq(n\\,{i})" for i in idx)
    d = os.path.join(out, "_f"); os.makedirs(d, exist_ok=True)
    for f in os.listdir(d): os.remove(os.path.join(d, f))
    subprocess.run(["ffmpeg", "-v", "error", "-i", mp4, "-vf", f"select='{sel}'", "-vsync", "0",
                    os.path.join(d, "%04d.png")], check=True)
    return [np.asarray(Image.open(os.path.join(d, f)).convert("RGB")).astype(np.float32)
            for f in sorted(os.listdir(d))]

# contact sheet
idx = [0, 150, 300, 450, 599]
fs = frames(idx)
for i, a in zip(idx, fs):
    Image.fromarray(a.astype(np.uint8)).save(os.path.join(out, f"{name}_mp4_f{i}.png"))
tw = 512; th = 288
sheet = Image.new("RGB", (tw * 5 + 16, th), (40, 40, 40))
for k, a in enumerate(fs):
    sheet.paste(Image.fromarray(a.astype(np.uint8)).resize((tw, th), Image.LANCZOS), (k * (tw + 4), 0))
sheet.save(os.path.join(out, f"{name}_contact.png"))

# banding
def blocks(a, b=16):
    h, w, _ = a.shape
    return a[: h // b * b, : w // b * b].reshape(h // b, b, w // b, b, 3).mean(axis=(1, 3))

print(f"-- banding ({name}), frames from mp4")
for i, a in zip(idx, fs):
    bl = blocks(a).mean(axis=2)  # luma-ish
    worst = 0.0; plateau = 0
    for prof in list(bl[::6]) + list(bl.T[::10]):   # rows and columns of block means
        sm = np.convolve(prof, np.ones(3) / 3, mode="valid")
        dif = np.abs(np.diff(sm))
        mask = (sm[:-1] > 3) & (sm[:-1] < 120)  # gradient-ish range, not hard edges
        # only count where the local slope is gentle (smooth falloffs)
        gentle = mask & (dif < 6)
        if gentle.any(): worst = max(worst, float(dif[gentle].max()))
        run = 0
        for d_ in dif[gentle] if gentle.any() else []:
            run = run + 1 if d_ < 0.02 else 0
            plateau = max(plateau, run)
    print(f"  frame {i:3d}: largest step between 16px block means in gentle falloffs = {worst:.2f} levels; longest flat run = {plateau} blocks")

# a literal pixel profile through the darkest gradient area (row at 60% height)
a = fs[2]
row = a[int(a.shape[0] * 0.6)].mean(axis=1)
box = np.convolve(row, np.ones(8) / 8, mode="valid")[::40]
print("  row@60% height, 8px-mean every 40px:", " ".join(f"{v:.1f}" for v in box[:32]))

# motion smoothness
fs2 = frames(list(range(270, 331)))
dm = [float(np.abs(fs2[i + 1] - fs2[i]).mean()) for i in range(len(fs2) - 1)]
print(f"-- motion ({name}) frames 270-330: mean |dframe| per step: min {min(dm):.3f} / mean {np.mean(dm):.3f} / max {max(dm):.3f}")
