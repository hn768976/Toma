#!/usr/bin/env python3
"""Verification helpers for the preview renders (run with python3 -I).

  verify.py probe <mp4> <expected_seconds>
  verify.py same <png_a> <png_b>                 # byte + pixel identity
  verify.py band <mp4> <frame> <x0,y0,x1,y1> ... # profiles along lines in the ENCODED mp4
  verify.py key <mp4> <frame_png_from_render> <frame>   # 2B background samples + key test
  verify.py sheet <mp4> <out_png> <frames>       # contact sheet (5 evenly spaced frames)
"""
import hashlib
import json
import subprocess
import sys

import numpy as np
from PIL import Image


def run(cmd):
    return subprocess.run(cmd, check=True, capture_output=True, text=True).stdout


def probe(path, seconds):
    out = run(["ffprobe", "-v", "error", "-show_entries",
               "stream=codec_type,codec_name,width,height,r_frame_rate,pix_fmt",
               "-show_entries", "format=duration", "-of", "json", path])
    j = json.loads(out)
    streams = j["streams"]
    v = [s for s in streams if s["codec_type"] == "video"]
    a = [s for s in streams if s["codec_type"] == "audio"]
    s = v[0]
    dur = float(j["format"]["duration"])
    ok = (s["width"] == 1280 and s["height"] == 720 and s["r_frame_rate"] == "30/1"
          and s["codec_name"] == "h264" and s["pix_fmt"] == "yuv420p" and not a
          and abs(dur - seconds) < 0.05)
    print(f"{path}: {s['codec_name']} {s['width']}x{s['height']} {s['r_frame_rate']} {s['pix_fmt']} "
          f"audio={len(a)} duration={dur:.3f} -> {'PASS' if ok else 'FAIL'}")
    return ok


def same(a, b):
    ha = hashlib.sha256(open(a, "rb").read()).hexdigest()
    hb = hashlib.sha256(open(b, "rb").read()).hexdigest()
    pa = np.asarray(Image.open(a).convert("RGB")).astype(int)
    pb = np.asarray(Image.open(b).convert("RGB")).astype(int)
    pix = pa.shape == pb.shape and np.array_equal(pa, pb)
    diff = int(np.abs(pa - pb).max()) if pa.shape == pb.shape else -1
    print(f"bytes_equal={ha == hb} pixels_equal={pix} max_diff={diff}")
    return pix


def frame_from_mp4(mp4, frame, out):
    run(["ffmpeg", "-v", "error", "-y", "-i", mp4, "-vf", f"select=eq(n\\,{frame})", "-vsync", "0",
         "-frames:v", "1", out])
    return np.asarray(Image.open(out).convert("RGB")).astype(float)


def band(mp4, frame, lines):
    img = frame_from_mp4(mp4, frame, "/tmp/_band.png")
    lum = img @ np.array([0.2126, 0.7152, 0.0722])
    worst = 0.0
    for ln in lines:
        x0, y0, x1, y1 = [int(v) for v in ln.split(",")]
        n = int(max(abs(x1 - x0), abs(y1 - y0)))
        xs = np.linspace(x0, x1, n).astype(int)
        ys = np.linspace(y0, y1, n).astype(int)
        prof = lum[ys, xs]
        # 9-px box smoothing removes grain; banding then shows as a sawtooth
        # around the local trend (31-px moving average), i.e. a residual that
        # stays near one code value. A smooth ramp has a residual << 1.
        k = np.ones(9) / 9
        sm = np.convolve(prof, k, mode="valid")
        trend = np.convolve(sm, np.ones(31) / 31, mode="valid")
        resid = np.abs(sm[15:-15] - trend)
        q = np.round(prof)
        run_len, best = 1, 1
        for i in range(1, len(q)):
            run_len = run_len + 1 if q[i] == q[i - 1] else 1
            best = max(best, run_len)
        worst = max(worst, resid.max())
        print(f"  line {ln}: range {prof.min():.1f}..{prof.max():.1f}  max residual vs trend {resid.max():.2f}  "
              f"longest flat run {best}px  levels {len(np.unique(q))}")
    print(f"  worst residual {worst:.2f} code values -> {'SMOOTH' if worst < 0.75 else 'CHECK'}")


def key(mp4, render_png, frame):
    ref = np.asarray(Image.open(render_png).convert("RGB")).astype(int)
    bg = (ref[..., 0] == 0) & (ref[..., 1] == 255) & (ref[..., 2] == 0)
    # 20 fixed sample points on a grid, keep those that are background with a margin
    pts = []
    for gy in np.linspace(40, 680, 9):
        for gx in np.linspace(40, 1240, 16):
            y, x = int(gy), int(gx)
            if bg[max(0, y - 6):y + 7, max(0, x - 6):x + 7].all():
                pts.append((x, y))
    pts = pts[:: max(1, len(pts) // 20)][:20]
    print(f"  render PNG background fraction {bg.mean():.3f}, exact #00FF00 in PNG at all samples: "
          f"{all(bg[y, x] for x, y in pts)}")
    enc = frame_from_mp4(mp4, frame, "/tmp/_key.png").astype(int)
    vals = [tuple(enc[y, x]) for x, y in pts]
    dev = max(max(abs(r - 0), abs(g - 255), abs(b - 0)) for r, g, b in vals)
    print(f"  {len(vals)} encoded samples, max deviation from (0,255,0): {dev} -> {'PASS' if dev <= 2 else 'FAIL'}")
    print("  samples:", vals[:20])
    # fringe check on the lossless render (pixels touching background must not be greenish)
    nb = np.zeros_like(bg)
    nb[1:] |= bg[:-1]; nb[:-1] |= bg[1:]; nb[:, 1:] |= bg[:, :-1]; nb[:, :-1] |= bg[:, 1:]
    edge = nb & ~bg
    px = ref[edge]
    greenish = px[:, 1] - np.maximum(px[:, 0], px[:, 2])
    print(f"  render edge pixels {edge.sum()}, max green excess {int(greenish.max())} "
          f"(>40 would be a green fringe) -> {'PASS' if greenish.max() <= 40 else 'FAIL'}")


def sheet(mp4, out, frames):
    frames = int(frames)
    idx = [round(i * (frames - 1) / 4) for i in range(5)]
    sel = "+".join(f"eq(n\\,{i})" for i in idx)
    run(["ffmpeg", "-v", "error", "-y", "-i", mp4, "-vf", f"select='{sel}',scale=512:-1,tile=5x1",
         "-vsync", "0", "-frames:v", "1", out])
    print(f"  sheet {out} frames {idx}")


if __name__ == "__main__":
    cmd, *args = sys.argv[1:]
    if cmd == "probe":
        sys.exit(0 if probe(args[0], float(args[1])) else 1)
    if cmd == "same":
        sys.exit(0 if same(args[0], args[1]) else 1)
    if cmd == "band":
        band(args[0], int(args[1]), args[2:])
    if cmd == "key":
        key(args[0], args[1], int(args[2]))
    if cmd == "sheet":
        sheet(*args)
