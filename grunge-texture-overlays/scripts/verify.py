#!/usr/bin/env python3
"""Verification helpers for the grunge overlay previews (needs numpy + Pillow + ffmpeg/ffprobe).

  verify.py probe   <mp4...>                         ffprobe: 1280x720, 30/1, h264, yuv420p, no audio, 20.0 s
  verify.py loop    <frame0.png> <frame600.png>      pixel-for-pixel equality
  verify.py levels  <id> <mp4> <stillDir>            50 empty points per frame (+ greyscale check)
  verify.py blend   <id> <mp4> <outDir>              composite over a colourful test image
  verify.py flicker <mp4> [start] [count]            hold lengths from frame differences
  verify.py same    <a.png> <b.png>                  byte-for-byte + pixel equality
"""
import hashlib
import json
import subprocess
import sys

import numpy as np
from PIL import Image

W, H = 1280, 720
BG = {"Black": (0, 0, 0), "White": (255, 255, 255), "Orange": (0xE0, 0x92, 0x0A)}
BLEND = {"Black": "Screen", "White": "Multiply", "Orange": "Normal"}


def frames(mp4, idx):
    """Decode the given frame indices (RGB uint8)."""
    out = {}
    for i in idx:
        raw = subprocess.run(
            ["ffmpeg", "-v", "error", "-i", mp4, "-vf", f"select=eq(n\\,{i})", "-vsync", "0", "-frames:v", "1",
             "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True, check=True).stdout
        out[i] = np.frombuffer(raw, np.uint8).reshape(H, W, 3)
    return out


def probe(paths):
    ok = True
    for p in paths:
        j = json.loads(subprocess.run(["ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", p],
                                      capture_output=True, check=True).stdout)
        v = [s for s in j["streams"] if s["codec_type"] == "video"]
        a = [s for s in j["streams"] if s["codec_type"] == "audio"]
        s = v[0]
        dur = float(j["format"]["duration"])
        nb = int(s.get("nb_frames", 0))
        good = (s["width"], s["height"]) == (W, H) and s["r_frame_rate"] == "30/1" and s["codec_name"] == "h264" \
            and s["pix_fmt"] == "yuv420p" and not a and abs(dur - 20.0) < 0.001 and nb == 600
        ok &= good
        print(f"{'PASS' if good else 'FAIL'} {p.split('/')[-1]}: {s['width']}x{s['height']} {s['r_frame_rate']} "
              f"{s['codec_name']} {s['pix_fmt']} audio={len(a)} dur={dur:.3f}s frames={nb}")
    return ok


def loop(a, b):
    A = np.asarray(Image.open(a).convert("RGB"))
    B = np.asarray(Image.open(b).convert("RGB"))
    diff = int(np.abs(A.astype(int) - B.astype(int)).max())
    print(f"{'PASS' if diff == 0 else 'FAIL'} loop: max pixel difference frame 0 vs 600 = {diff}")
    return diff == 0


def levels(cid, mp4, still_dir):
    """Empty points are picked where the lossless still is exactly the background in a 9x9 neighbourhood,
    then checked in the decoded H.264 frame."""
    kind = cid.split("_")[1]
    bg = np.array(BG[kind])
    tol = 2 if kind == "Orange" else 1
    rng = np.random.default_rng(7)
    ok = True
    worst = 0
    grey_dev = 0
    fidx = [0, 150, 300, 450]
    dec = frames(mp4, fidx)
    for f in fidx:
        S = np.asarray(Image.open(f"{still_dir}/{cid.replace('_', '-')}_f{f}.png").convert("RGB")).astype(int)
        empty = np.all(S == bg, axis=2).astype(np.uint8)
        # 9x9 erosion
        e = empty.copy()
        for dy in range(-4, 5):
            for dx in range(-4, 5):
                e &= np.roll(np.roll(empty, dy, 0), dx, 1)
        e[:5], e[-5:], e[:, :5], e[:, -5:] = 0, 0, 0, 0
        ys, xs = np.nonzero(e)
        if len(ys) < 50:
            print(f"  frame {f}: only {len(ys)} empty points")
            sel = np.arange(len(ys))
        else:
            sel = rng.choice(len(ys), 50, replace=False)
        D = dec[f].astype(int)
        vals = D[ys[sel], xs[sel]]
        dev = int(np.abs(vals - bg).max()) if len(sel) else 0
        worst = max(worst, dev)
        ok &= dev <= tol
        if kind != "Orange":
            gd = int(max(np.abs(D[..., 0] - D[..., 1]).max(), np.abs(D[..., 1] - D[..., 2]).max()))
            grey_dev = max(grey_dev, gd)
            ok &= gd <= 1
    msg = f"empty points max deviation {worst} (tol ±{tol})"
    if kind != "Orange":
        msg += f", greyscale max |R-G|,|G-B| over all pixels {grey_dev} (tol ±1)"
    print(f"{'PASS' if ok else 'FAIL'} levels {cid}: {msg}")
    return ok


def test_photo():
    """Synthetic colourful test image (sky gradient, sun, hills, coloured shapes, fine texture)."""
    y, x = np.mgrid[0:H, 0:W].astype(float)
    img = np.zeros((H, W, 3))
    t = y / H
    img[..., 0] = 0.15 + 0.7 * t
    img[..., 1] = 0.45 + 0.25 * t
    img[..., 2] = 0.95 - 0.5 * t
    sun = np.exp(-(((x - 950) ** 2 + (y - 200) ** 2) / (2 * 90 ** 2)))
    img += sun[..., None] * np.array([0.9, 0.6, 0.1])
    hill = y > 470 + 60 * np.sin(x / 140)
    img[hill] = img[hill] * 0.3 + np.array([0.1, 0.55, 0.2]) * 0.7
    for cx, cy, r, c in [(250, 380, 110, (0.9, 0.15, 0.35)), (620, 560, 90, (0.95, 0.8, 0.1)), (420, 200, 70, (0.3, 0.2, 0.9))]:
        m = (x - cx) ** 2 + (y - cy) ** 2 < r ** 2
        img[m] = c
    rng = np.random.default_rng(1)
    img += rng.normal(0, 0.02, img.shape)
    return np.clip(img, 0, 1)


def blend(cid, mp4, outdir):
    kind = cid.split("_")[1]
    mode = BLEND[kind]
    photo = test_photo()
    fidx = [60, 180, 300, 420, 540]
    dec = frames(mp4, fidx)
    rows = []
    report = []
    for f in fidx:
        o = dec[f].astype(float) / 255
        if mode == "Screen":
            c = 1 - (1 - photo) * (1 - o)
        elif mode == "Multiply":
            c = photo * o
        else:
            c = o
        # how much of the frame the texture touches, and the overall change of the photo
        touched = np.any(np.abs(o - np.array(BG[kind]) / 255) > 2 / 255, axis=2)
        mean_shift = (c - photo).mean(axis=(0, 1)) * 255
        cen = (slice(int(H * 0.175), int(H * 0.825)), slice(int(W * 0.125), int(W * 0.875)))
        centre_diff = np.abs(c[cen] - photo[cen]).max() * 255
        untouched_diff = np.abs(c[~touched] - photo[~touched]).max() * 255 if (~touched).any() else 0
        report.append((f, touched.mean() * 100, mean_shift, centre_diff, untouched_diff))
        rows.append(np.concatenate([photo, c], axis=1))
    Image.fromarray((np.concatenate(rows[:3], axis=0) * 255).astype(np.uint8)).resize((1280, 1080)).save(
        f"{outdir}/blend_{cid}.png")
    print(f"blend {cid} ({mode}):")
    for f, cov, ms, cd, ud in report:
        print(f"  frame {f}: texture covers {cov:5.1f}% | mean RGB shift {ms[0]:+5.1f} {ms[1]:+5.1f} {ms[2]:+5.1f}"
              f" | untouched pixels max change {ud:.1f} | centre 75x65% max change {cd:.1f}")


def flicker(mp4, start=0, count=30):
    idx = list(range(start, start + count + 1))
    dec = frames(mp4, idx)
    d = [float(np.abs(dec[i + 1].astype(int) - dec[i].astype(int)).mean()) for i in idx[:-1]]
    changes = [i + 1 for i, v in zip(idx, d) if v > 1.5]
    runs = np.diff([start] + changes)
    print(f"flicker {mp4.split('/')[-1]} frames {start}-{start + count}: mean |diff| per step = "
          + " ".join(f"{v:.1f}" for v in d))
    print(f"  swaps at {changes}; hold lengths {list(runs)}")
    return runs


def same(a, b):
    ha = hashlib.sha256(open(a, "rb").read()).hexdigest()
    hb = hashlib.sha256(open(b, "rb").read()).hexdigest()
    A = np.asarray(Image.open(a))
    B = np.asarray(Image.open(b))
    px = A.shape == B.shape and bool((A == B).all())
    print(f"{'PASS' if px else 'FAIL'} determinism: pixels identical={px}, file bytes identical={ha == hb}")
    return px


if __name__ == "__main__":
    cmd, args = sys.argv[1], sys.argv[2:]
    if cmd == "probe":
        sys.exit(0 if probe(args) else 1)
    if cmd == "loop":
        sys.exit(0 if loop(*args) else 1)
    if cmd == "levels":
        sys.exit(0 if levels(*args) else 1)
    if cmd == "blend":
        blend(*args)
    if cmd == "flicker":
        flicker(args[0], *[int(a) for a in args[1:]])
    if cmd == "same":
        sys.exit(0 if same(*args) else 1)
