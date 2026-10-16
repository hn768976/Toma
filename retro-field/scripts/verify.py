#!/usr/bin/env python3
"""Verification helpers for the previews. Run from the project root.

  python3 scripts/verify.py probe out/previews/*.mp4
  python3 scripts/verify.py same a.png b.png          # byte/pixel identity
  python3 scripts/verify.py black out/previews/ParticleSmoke_White.mp4
  python3 scripts/verify.py ramp file.mp4 x0 y0 x1 y1 [time]  # gradient profile
"""
import json, subprocess, sys, hashlib, io

def probe(path):
    out = subprocess.check_output(["ffprobe", "-v", "error", "-show_entries",
        "stream=codec_type,codec_name,width,height,r_frame_rate,pix_fmt",
        "-show_entries", "format=duration", "-of", "json", path])
    j = json.loads(out)
    streams = j["streams"]
    v = [s for s in streams if s["codec_type"] == "video"][0]
    audio = [s for s in streams if s["codec_type"] == "audio"]
    dur = float(j["format"]["duration"])
    ok = (v["width"], v["height"]) == (1280, 720) and v["r_frame_rate"] == "30/1" \
        and v["codec_name"] == "h264" and v["pix_fmt"] == "yuv420p" and not audio and abs(dur - 20.0) < 0.05
    print(f"{'PASS' if ok else 'FAIL'} {path}: {v['codec_name']} {v['width']}x{v['height']} {v['r_frame_rate']} {v['pix_fmt']} audio={len(audio)} {dur:.3f}s")
    return ok

def frame_png(path, t):
    from PIL import Image
    data = subprocess.check_output(["ffmpeg", "-v", "error", "-ss", str(t), "-i", path, "-frames:v", "1", "-f", "image2pipe", "-vcodec", "png", "-"])
    return Image.open(io.BytesIO(data)).convert("RGB")

def same(a, b):
    from PIL import Image, ImageChops
    ha = hashlib.sha256(open(a, "rb").read()).hexdigest()
    hb = hashlib.sha256(open(b, "rb").read()).hexdigest()
    ia, ib = Image.open(a).convert("RGB"), Image.open(b).convert("RGB")
    diff = ImageChops.difference(ia, ib).getbbox()
    print(f"{'IDENTICAL' if diff is None else 'DIFFERENT'} pixels; file bytes {'equal' if ha == hb else 'differ'}: {a} vs {b}")
    return diff is None

def black(path):
    # 50 points in empty areas: sample a grid over the bottom of several frames,
    # keep the points whose 9x9 neighbourhood is empty in the rendered frame
    import random
    rng = random.Random(7)
    worst = 0
    picked = 0
    for t in (2.0, 7.0, 12.0, 17.0):
        im = frame_png(path, t)
        W, H = im.size
        tries = 0
        n = 0
        while n < 13 and tries < 5000:
            tries += 1
            x, y = rng.randrange(5, W - 5), rng.randrange(5, H - 5)
            nb = [max(im.getpixel((x + dx, y + dy))) for dx in (-4, 0, 4) for dy in (-4, 0, 4)]
            if max(nb) <= 3:  # an empty area (no grain nearby)
                v = im.getpixel((x, y))
                worst = max(worst, max(v))
                n += 1
        picked += n
    print(f"black level: {picked} empty-area samples, max channel value {worst} -> {'PASS' if worst <= 1 else 'FAIL'}")

def ramp(path, x0, y0, x1, y1, t=10.0):
    im = frame_png(path, t)
    n = 40
    vals = []
    for i in range(n + 1):
        x = round(x0 + (x1 - x0) * i / n); y = round(y0 + (y1 - y0) * i / n)
        # 5x5 mean to see the underlying gradient through grain/dither
        px = [im.getpixel((x + dx, y + dy)) for dx in range(-2, 3) for dy in range(-2, 3)]
        vals.append(tuple(round(sum(p[c] for p in px) / 25, 1) for c in range(3)))
    steps = [max(abs(vals[i + 1][c] - vals[i][c]) for c in range(3)) for i in range(n)]
    print(" ".join(f"{v[0]:.0f},{v[1]:.0f},{v[2]:.0f}" for v in vals))
    print(f"max step between neighbouring samples: {max(steps):.1f}")

if __name__ == "__main__":
    cmd, *a = sys.argv[1:]
    if cmd == "probe":
        sys.exit(0 if all([probe(p) for p in a]) else 1)
    if cmd == "same":
        sys.exit(0 if same(*a) else 1)
    if cmd == "black":
        black(a[0])
    if cmd == "ramp":
        ramp(a[0], *map(int, a[1:5]), *(map(float, a[5:6])))
