#!/usr/bin/env python3
"""Checks on rendered output (needs ffmpeg/ffprobe, Pillow, numpy).

  python3 scripts/verify.py probe  out/final/Cubes_ETF.mp4
  python3 scripts/verify.py same   a.png b.png             # byte-for-byte + pixel diff
  python3 scripts/verify.py sheet  out/final/Cubes_ETF.mp4 out/sheet.png   # every 15th frame
  python3 scripts/verify.py band   out/final/Cubes_ETF.mp4 <frame> <x0> <y0> <x1> <y1>
"""
import hashlib
import json
import subprocess
import sys

import numpy as np
from PIL import Image


def probe(path):
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries",
         "stream=codec_type,codec_name,width,height,r_frame_rate,pix_fmt,nb_frames",
         "-show_entries", "format=duration", "-of", "json", path],
        capture_output=True, text=True, check=True).stdout
    info = json.loads(out)
    streams = info["streams"]
    video = [s for s in streams if s["codec_type"] == "video"]
    audio = [s for s in streams if s["codec_type"] == "audio"]
    v = video[0]
    dur = float(info["format"]["duration"])
    checks = {
        "resolution 1920x1080": (v["width"], v["height"]) == (1920, 1080),
        "frame rate 30/1": v["r_frame_rate"] == "30/1",
        "duration 10.0s": abs(dur - 10.0) < 0.02,
        "codec h264": v["codec_name"] == "h264",
        "pix_fmt yuv420p": v["pix_fmt"] == "yuv420p",
        "no audio stream": len(audio) == 0,
        "300 frames": int(v.get("nb_frames", 0)) == 300,
    }
    print(f"{path}: {v['width']}x{v['height']} {v['r_frame_rate']} {dur:.3f}s "
          f"{v['codec_name']} {v['pix_fmt']} frames={v.get('nb_frames')} audio={len(audio)}")
    for k, ok in checks.items():
        print(f"  {'PASS' if ok else 'FAIL'} {k}")
    return all(checks.values())


def same(a, b):
    ha = hashlib.sha256(open(a, "rb").read()).hexdigest()
    hb = hashlib.sha256(open(b, "rb").read()).hexdigest()
    pa = np.asarray(Image.open(a).convert("RGB")).astype(int)
    pb = np.asarray(Image.open(b).convert("RGB")).astype(int)
    diff = np.abs(pa - pb)
    print(f"{a}\n  sha256 {ha}\n{b}\n  sha256 {hb}")
    print(f"  file bytes identical: {ha == hb}")
    print(f"  pixels identical: {diff.max() == 0} (max diff {diff.max()}, "
          f"differing pixels {(diff.sum(axis=2) > 0).sum()})")
    return ha == hb


def frame_png(video, frame, out):
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", video, "-vf",
                    f"select=eq(n\\,{frame})", "-vsync", "vfr", "-frames:v", "1", out],
                   check=True)


def sheet(video, out):
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", video, "-vf",
                    "select='not(mod(n\\,15))',scale=384:-1,"
                    "drawtext=text='%{eif\\:n*15\\:d}':x=6:y=6:fontcolor=red:fontsize=20,tile=5x4",
                    "-frames:v", "1", out], check=True)
    print(f"wrote {out} (frames 0,15,...,285)")


def band(video, frame, x0, y0, x1, y1):
    png = f"/tmp/band_{frame}.png"
    frame_png(video, frame, png)
    im = np.asarray(Image.open(png).convert("RGB")).astype(float)
    lum = im @ np.array([0.2126, 0.7152, 0.0722])
    n = int(max(abs(x1 - x0), abs(y1 - y0))) + 1
    xs = np.linspace(x0, x1, n).round().astype(int)
    ys = np.linspace(y0, y1, n).round().astype(int)
    raw = lum[ys, xs]
    # Average 9 parallel lines (perpendicular offset) to see the underlying ramp
    # through the grain.
    dx, dy = (x1 - x0), (y1 - y0)
    L = (dx * dx + dy * dy) ** 0.5
    px, py = -dy / L, dx / L
    acc = []
    for k in range(-4, 5):
        acc.append(lum[(ys + round(k * py)).clip(0, lum.shape[0] - 1),
                       (xs + round(k * px)).clip(0, lum.shape[1] - 1)])
    avg = np.mean(acc, axis=0)
    smooth = np.convolve(avg, np.ones(5) / 5, mode="valid")
    print(f"frame {frame}, line ({x0},{y0})->({x1},{y1}), {n} px")
    print("raw luma   :", " ".join(f"{v:.0f}" for v in raw))
    print("9-line avg :", " ".join(f"{v:.1f}" for v in avg))
    steps = np.diff(smooth)
    # A banded ramp shows flat runs (|step| < 0.05) broken by single jumps.
    flat = np.abs(steps) < 0.05
    longest_flat = max((len(s) for s in "".join("1" if f else "0" for f in flat).split("0")), default=0)
    print(f"range {avg.min():.1f}..{avg.max():.1f}, largest single step in 5-px smoothed "
          f"profile {np.abs(steps).max():.2f}, longest flat run {longest_flat} px")
    # Distinct 8-bit levels used along the raw line vs. the ramp's span.
    print(f"distinct 8-bit luma levels on the raw line: {len(np.unique(raw.round()))}")


if __name__ == "__main__":
    cmd = sys.argv[1]
    if cmd == "probe":
        sys.exit(0 if all(probe(p) for p in sys.argv[2:]) else 1)
    if cmd == "same":
        sys.exit(0 if same(sys.argv[2], sys.argv[3]) else 1)
    if cmd == "sheet":
        sheet(sys.argv[2], sys.argv[3])
    if cmd == "band":
        band(sys.argv[2], int(sys.argv[3]), *map(int, sys.argv[4:8]))
    if cmd == "frame":
        frame_png(sys.argv[2], int(sys.argv[3]), sys.argv[4])
