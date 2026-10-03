#!/usr/bin/env python3
"""
Banding check on the ENCODED preview: decodes one frame from an mp4 and reads
pixel values along lines across dark gradients and glows.

For each probe line it reports the luminance profile after a light 1-D
smoothing (to look through the grain), the largest jump between neighbouring
smoothed samples, and the longest run of identical raw 8-bit values. Smooth
gradients show small jumps and short runs; banding shows flat runs ending in
1-code steps that repeat.

Usage: scripts/banding-check.py <file.mp4> <frame> <x0,y0,x1,y1> [...]
"""
import subprocess
import sys

import numpy as np


def frame_rgb(path, n):
    out = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", path, "-vf", f"select=eq(n\\,{n})", "-frames:v", "1",
         "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
        check=True, capture_output=True).stdout
    probe = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height",
         "-of", "csv=p=0", path], check=True, capture_output=True, text=True).stdout.strip()
    w, h = map(int, probe.split(","))
    return np.frombuffer(out, np.uint8).reshape(h, w, 3)


def main():
    path, n = sys.argv[1], int(sys.argv[2])
    img = frame_rgb(path, n).astype(float)
    luma = img @ np.array([0.2126, 0.7152, 0.0722])
    for spec in sys.argv[3:]:
        x0, y0, x1, y1 = map(int, spec.split(","))
        m = max(abs(x1 - x0), abs(y1 - y0)) + 1
        xs = np.linspace(x0, x1, m).round().astype(int)
        ys = np.linspace(y0, y1, m).round().astype(int)
        raw = luma[ys, xs]
        # 5-px box blur along the line (grain is per-pixel)
        k = np.ones(9) / 9
        smooth = np.convolve(raw, k, mode="valid")
        jumps = np.abs(np.diff(smooth))
        rawc = img[ys, xs, 2].astype(int)  # blue channel carries these looks
        runs, best, cur = [], 1, 1
        for a, b in zip(rawc[:-1], rawc[1:]):
            cur = cur + 1 if a == b else 1
            best = max(best, cur)
        print(f"line {spec}: luma {raw.min():.1f}..{raw.max():.1f}  "
              f"max smoothed step {jumps.max():.2f}  longest flat run (B channel) {best}px")
        samples = smooth[:: max(1, len(smooth) // 16)]
        print("   profile:", " ".join(f"{v:.1f}" for v in samples))


if __name__ == "__main__":
    main()
