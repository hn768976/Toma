#!/usr/bin/env python3
"""Verification helpers for the encoded previews (run with python3 -I).

  checks.py green   <mp4> [frames...]   flat #00FF00 check on screen (+ background)
  checks.py band    <mp4> <frame>       banding check across the background gradient
  checks.py key     <mp4> <frame> <out> ffmpeg chromakey test on one frame
  checks.py same    <pngA> <pngB>       pixel-for-pixel / byte comparison
"""
import subprocess
import sys
import tempfile

import numpy as np
from PIL import Image


def frame_rgb(mp4, n):
    with tempfile.NamedTemporaryFile(suffix=".png") as t:
        subprocess.run(
            ["ffmpeg", "-v", "error", "-y", "-i", mp4, "-vf", f"select=eq(n\\,{n})",
             "-frames:v", "1", "-pix_fmt", "rgb24", t.name],
            check=True,
        )
        return np.asarray(Image.open(t.name).convert("RGB")).astype(int)


def erode(mask, r):
    m = mask.copy()
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            m &= np.roll(np.roll(mask, dy, 0), dx, 1)
    return m


def green(mp4, frames):
    ok = True
    for n in frames:
        img = frame_rgb(mp4, n)
        g = (img[..., 1] > 200) & (img[..., 0] < 80) & (img[..., 2] < 80)
        # sample 10 px clear of the phone: closer than that, H.264 ringing around the
        # high-contrast edge moves values by a few levels (reported separately)
        core = erode(g, 10)
        edge = erode(g, 2) & ~core
        if core.sum() == 0:
            print(f"frame {n}: no green visible")
            continue
        px = img[core]
        lo, hi = px.min(0), px.max(0)
        uniq = len(np.unique(px.reshape(-1, 3), axis=0))
        flat = (hi - lo).max() <= 2  # +/-1 around one value
        ok &= bool(flat)
        print(f"frame {n}: {core.sum()} green px, R {lo[0]}-{hi[0]} G {lo[1]}-{hi[1]} "
              f"B {lo[2]}-{hi[2]}, {uniq} distinct -> {'FLAT' if flat else 'NOT FLAT'}")
        if edge.any():
            e = img[edge]
            dev = np.abs(e - np.array([0, 255, 0])).max(1)
            print(f"   edge band (2-10 px from phone): max dev {dev.max()}, "
                  f"{(dev > 1).mean() * 100:.2f}% of band px beyond +/-1 (codec ringing)")
    print("GREEN", "PASS" if ok else "FAIL")
    return ok


def band(mp4, n):
    img = frame_rgb(mp4, n).astype(float)
    h, w, _ = img.shape
    lum = img.mean(2)
    # sample the left-edge column and the top row (background only at these edges)
    worst = 0.0
    for name, line in [("left col", lum[:, 8:24].mean(1)), ("top row", lum[8:24, :].mean(0)),
                       ("bottom row", lum[h - 24:h - 8, :].mean(0))]:
        k = 15
        sm = np.convolve(line, np.ones(k) / k, mode="valid")
        steps = np.abs(np.diff(sm))
        raw_steps = np.abs(np.diff(line))
        print(f"{name}: range {line.min():.1f}-{line.max():.1f}, smoothed max step "
              f"{steps.max():.3f}, raw max step {raw_steps.max():.2f}")
        worst = max(worst, steps.max())
    # distinct-value runs along the top row of one channel: long flat runs = banding
    row = img[16, :, 1].astype(int)
    runs = np.diff(np.flatnonzero(np.diff(row) != 0))
    print(f"longest constant run on top row (G): {runs.max() if len(runs) else w} px")
    ok = worst < 0.5
    print("BAND", "PASS" if ok else "FAIL")
    return ok


def key(mp4, n, out):
    src = tempfile.NamedTemporaryFile(suffix=".png", delete=False).name
    keyed = tempfile.NamedTemporaryFile(suffix=".png", delete=False).name
    Image.fromarray(frame_rgb(mp4, n).astype(np.uint8)).save(src)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", src, "-vf",
                    "chromakey=0x00FF00:0.12:0.06,despill=type=green:mix=0.5:expand=0,format=rgba",
                    keyed], check=True)
    rgba = np.asarray(Image.open(keyed)).astype(int)
    orig = np.asarray(Image.open(src).convert("RGB")).astype(int)
    a = rgba[..., 3]
    greenish = (orig[..., 1] > 200) & (orig[..., 0] < 80) & (orig[..., 2] < 80)
    body = erode(~greenish, 2)  # phone pixels away from the key edge
    holes = int((body & (a < 250)).sum())
    kept = a > 128
    fringe = int((kept & (rgba[..., 1] - np.maximum(rgba[..., 0], rgba[..., 2]) > 40)).sum())
    print(f"body px {int(body.sum())}, holes(alpha<250) {holes}, opaque green-fringe px {fringe}, "
          f"keyed-out px {int((a == 0).sum())}")
    # composite over magenta for a visual check
    mag = np.zeros_like(orig)
    mag[..., 0] = 255
    mag[..., 2] = 255
    al = a[..., None] / 255.0
    comp = (rgba[..., :3] * al + mag * (1 - al)).astype(np.uint8)
    Image.fromarray(comp).save(out)
    ok = holes == 0 and fringe == 0
    print("KEY", "PASS" if ok else "FAIL")
    return ok


def same(a, b):
    A = np.asarray(Image.open(a).convert("RGB")).astype(int)
    B = np.asarray(Image.open(b).convert("RGB")).astype(int)
    if A.shape != B.shape:
        print("SHAPE DIFF", A.shape, B.shape)
        return False
    d = np.abs(A - B)
    print(f"max diff {d.max()}, differing px {(d.max(2) > 0).sum()}")
    ok = d.max() == 0
    print("SAME", "PASS" if ok else "FAIL")
    return ok


if __name__ == "__main__":
    cmd = sys.argv[1]
    if cmd == "green":
        r = green(sys.argv[2], [int(x) for x in sys.argv[3:]] or [0, 75, 150, 225, 299])
    elif cmd == "band":
        r = band(sys.argv[2], int(sys.argv[3]))
    elif cmd == "key":
        r = key(sys.argv[2], int(sys.argv[3]), sys.argv[4])
    elif cmd == "same":
        r = same(sys.argv[2], sys.argv[3])
    sys.exit(0 if r else 1)
