#!/usr/bin/env python3
"""Verification helpers (needs ffmpeg/ffprobe, Pillow, numpy).

  scripts/verify.py probe  <mp4...>                 file checks
  scripts/verify.py same   <a.png> <b.png>          pixel-for-pixel + byte compare
  scripts/verify.py black  <mp4> <frame> x0,y0,x1,y1 max value in an empty region
  scripts/verify.py band   <mp4> <frame> x0,y0,x1,y1 step histogram along a line
"""
import json, subprocess, sys, hashlib
import numpy as np
from PIL import Image

def frame_from_mp4(mp4, n):
    out = subprocess.run(["ffmpeg", "-v", "error", "-i", mp4, "-vf", f"select=eq(n\\,{n})",
                          "-vframes", "1", "-f", "image2pipe", "-vcodec", "png", "-"],
                         capture_output=True, check=True).stdout
    import io
    return np.array(Image.open(io.BytesIO(out)).convert("RGB")).astype(int)

def probe(files):
    ok = True
    for f in files:
        j = json.loads(subprocess.run(["ffprobe", "-v", "error", "-show_streams", "-show_format",
                                       "-of", "json", f], capture_output=True, check=True).stdout)
        v = [s for s in j["streams"] if s["codec_type"] == "video"]
        a = [s for s in j["streams"] if s["codec_type"] == "audio"]
        s = v[0]
        dur = float(j["format"]["duration"])
        good = (s["width"], s["height"]) == (1280, 720) and s["r_frame_rate"] == "30/1" \
            and s["codec_name"] == "h264" and s["pix_fmt"] == "yuv420p" and not a
        ok &= good
        print(f"{f}: {s['codec_name']} {s['width']}x{s['height']} {s['r_frame_rate']} {s['pix_fmt']} "
              f"audio={len(a)} frames={s.get('nb_frames')} duration={dur:.3f}s {'OK' if good else 'FAIL'}")
    return ok

def same(a, b):
    A = np.array(Image.open(a).convert("RGB")).astype(int)
    B = np.array(Image.open(b).convert("RGB")).astype(int)
    ha = hashlib.sha256(open(a, "rb").read()).hexdigest()[:16]
    hb = hashlib.sha256(open(b, "rb").read()).hexdigest()[:16]
    d = np.abs(A - B)
    print(f"{a} vs {b}: max diff {d.max()}, differing pixels {(d.max(2) > 0).sum()}, "
          f"bytes {'IDENTICAL' if ha == hb else 'differ'} ({ha} / {hb})")
    return d.max() == 0

def region(arg):
    return [int(v) for v in arg.split(",")]

def black(mp4, n, r):
    x0, y0, x1, y1 = region(r)
    f = frame_from_mp4(mp4, int(n))
    reg = f[y0:y1, x0:x1]
    print(f"{mp4} frame {n} region {r}: max {reg.max()}, mean {reg.mean():.3f}, "
          f"nonzero px {(reg.max(2) > 0).sum()} / {reg.shape[0]*reg.shape[1]}")
    return reg.max() <= 1

def band(mp4, n, r):
    x0, y0, x1, y1 = region(r)
    f = frame_from_mp4(mp4, int(n))
    num = max(abs(x1 - x0), abs(y1 - y0))
    xs = np.linspace(x0, x1, num).astype(int)
    ys = np.linspace(y0, y1, num).astype(int)
    # average a 9px-wide strip perpendicular-ish to smooth out grain, then
    # look for flat runs and steps in the smoothed profile
    prof = np.array([f[max(0, y-4):y+5, max(0, x-4):x+5].reshape(-1, 3).mean(0) for x, y in zip(xs, ys)])
    lum = prof @ np.array([0.2126, 0.7152, 0.0722])
    d = np.diff(lum)
    raw = np.array([f[y, x] for x, y in zip(xs, ys)])
    rl = raw @ np.array([0.2126, 0.7152, 0.0722])
    runs, cur = [], 1
    for i in range(1, len(rl)):
        if abs(rl[i] - rl[i-1]) < 0.01: cur += 1
        else: runs.append(cur); cur = 1
    runs.append(cur)
    print(f"{mp4} frame {n} line {r}: lum {lum.min():.1f}..{lum.max():.1f}, "
          f"max step (smoothed) {np.abs(d).max():.2f}, longest flat run (raw) {max(runs)} px, "
          f"samples: {np.round(lum[::max(1, num // 12)], 1).tolist()}")
    return np.abs(d).max() < 1.5

if __name__ == "__main__":
    cmd, *args = sys.argv[1:]
    res = {"probe": lambda: probe(args), "same": lambda: same(*args),
           "black": lambda: black(*args), "band": lambda: band(*args)}[cmd]()
    sys.exit(0 if res else 1)
