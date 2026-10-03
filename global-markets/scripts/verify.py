#!/usr/bin/env python3
"""Verification helpers (needs Pillow + numpy).

  verify.py same A.png B.png          -> byte + pixel comparison
  verify.py banding video.mp4 frame   -> extracts a frame from the encoded mp4
                                         and prints pixel steps along background lines
"""
import hashlib
import subprocess
import sys

import numpy as np
from PIL import Image


def same(a, b):
    ba, bb = open(a, "rb").read(), open(b, "rb").read()
    pa = np.asarray(Image.open(a).convert("RGB")).astype(int)
    pb = np.asarray(Image.open(b).convert("RGB")).astype(int)
    diff = np.abs(pa - pb)
    print(f"bytes identical: {ba == bb}  sha1 {hashlib.sha1(ba).hexdigest()[:12]} / {hashlib.sha1(bb).hexdigest()[:12]}")
    print(f"pixels identical: {not diff.any()}  max diff {diff.max()}  differing px {(diff.sum(axis=2) > 0).sum()}")
    return ba == bb and not diff.any()


def banding(video, frame, out_png):
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", video, "-vf", f"select=eq(n\\,{frame})", "-frames:v", "1", out_png], check=True)
    im = np.asarray(Image.open(out_png).convert("RGB")).astype(float)
    h, w, _ = im.shape
    # Lines through background regions: a smoothed profile should change in small
    # steps; we report the largest step of the smoothed (8 px box) luminance and
    # the longest run of identical raw values (flat plateaus = bands).
    for name, line in [("row 3%", im[int(h * 0.03), :, :]), ("row 97%", im[int(h * 0.97), :, :]),
                       ("col 2%", im[:, int(w * 0.02), :]), ("col 98%", im[:, int(w * 0.98), :]),
                       ("diag", np.array([im[int(i * (h - 1) / (w - 1)), i, :] for i in range(w)]))]:
        lum = line @ np.array([0.2126, 0.7152, 0.0722])
        k = np.ones(8) / 8
        sm = np.convolve(lum, k, mode="valid")
        steps = np.abs(np.diff(sm))
        run, best, prev = 1, 1, None
        for v in np.round(lum).astype(int):
            run = run + 1 if v == prev else 1
            best = max(best, run)
            prev = v
        print(f"{name:8s} lum {lum.min():6.1f}..{lum.max():6.1f}  max smoothed step {steps.max():.2f}  "
              f"mean step {steps.mean():.3f}  longest flat run {best} px")


if __name__ == "__main__":
    if sys.argv[1] == "same":
        sys.exit(0 if same(sys.argv[2], sys.argv[3]) else 1)
    if sys.argv[1] == "banding":
        banding(sys.argv[2], int(sys.argv[3]), sys.argv[4] if len(sys.argv) > 4 else "/tmp/banding.png")
