#!/usr/bin/env python3
"""Verification helpers for the nine previews.

  python3 scripts/verify.py probe   out/previews/*.mp4
  python3 scripts/verify.py sheet   out/previews/X.mp4 out/sheets/X.png
  python3 scripts/verify.py banding out/previews/X.mp4 <frame> <region spec...>
  python3 scripts/verify.py same    a.png b.png
  python3 scripts/verify.py side    ref.png mine.png out.png

Banding: reads pixel values from a frame decoded from the encoded mp4 along
lines through gradient areas, box-smooths them (to average out grain) and
reports the largest jump between neighbouring smoothed samples and the
longest flat run of the raw luma. Steps (banding) show up as runs of a
constant value followed by a jump; a smooth ramp shows neither.
"""
import json
import subprocess
import sys

import numpy as np
from PIL import Image


def probe(paths):
    ok_all = True
    for p in paths:
        out = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries",
             "stream=codec_type,codec_name,width,height,r_frame_rate,pix_fmt",
             "-show_entries", "format=duration", "-of", "json", p],
            capture_output=True, text=True, check=True).stdout
        d = json.loads(out)
        streams = d["streams"]
        v = [s for s in streams if s["codec_type"] == "video"]
        a = [s for s in streams if s["codec_type"] == "audio"]
        dur = float(d["format"]["duration"])
        s = v[0]
        ok = (len(v) == 1 and not a and s["codec_name"] == "h264" and s["width"] == 1280 and s["height"] == 720
              and s["r_frame_rate"] == "30/1" and s["pix_fmt"] == "yuv420p" and abs(dur - 20.0) < 0.02)
        ok_all &= ok
        print(f"{'PASS' if ok else 'FAIL'} {p}: {s['codec_name']} {s['width']}x{s['height']} {s['r_frame_rate']} "
              f"{s['pix_fmt']} audio={len(a)} duration={dur:.3f}")
    return ok_all


def frame(mp4, n):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", mp4, "-vf", f"select=eq(n\\,{n})", "-vsync", "0",
                          "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.uint8).reshape(720, 1280, 3)


def sheet(mp4, out, frames=(0, 120, 240, 360, 480), scale=0.4):
    imgs = [Image.fromarray(frame(mp4, n)) for n in frames]
    w, h = int(1280 * scale), int(720 * scale)
    canvas = Image.new("RGB", (w * len(imgs) + 4 * (len(imgs) - 1), h), (255, 255, 255))
    for i, im in enumerate(imgs):
        canvas.paste(im.resize((w, h), Image.LANCZOS), (i * (w + 4), 0))
    canvas.save(out)


def banding(mp4, n, specs):
    img = frame(mp4, n).astype(np.float64)
    luma = 0.2126 * img[..., 0] + 0.7152 * img[..., 1] + 0.0722 * img[..., 2]
    for spec in specs:
        # spec: "v:x:y0:y1" (vertical line) or "h:y:x0:x1"; averages a 9-px wide strip
        kind, a, b, c = spec.split(":")
        a, b, c = int(a), int(b), int(c)
        if kind == "v":
            prof = luma[b:c, max(0, a - 4):a + 5].mean(axis=1)
            rawline = np.round(img[b:c, a, 2]).astype(int)
        else:
            prof = luma[max(0, a - 4):a + 5, b:c].mean(axis=0)
            rawline = np.round(img[a, b:c, 2]).astype(int)
        k = 15
        sm = np.convolve(prof, np.ones(k) / k, mode="valid")
        jump = np.abs(np.diff(sm)).max()
        # longest constant run in the (unsmoothed) strip-mean rounded to 8-bit
        q = np.round(prof).astype(int)
        run = longest = 1
        for i in range(1, len(q)):
            run = run + 1 if q[i] == q[i - 1] else 1
            longest = max(longest, run)
        print(f"  {spec}: luma {prof.min():.1f}..{prof.max():.1f}, max step of smoothed profile {jump:.2f}/255, "
              f"longest flat run {longest}px, raw B unique values {len(set(rawline.tolist()))}")


def same(a, b):
    x = np.asarray(Image.open(a).convert("RGB")).astype(int)
    y = np.asarray(Image.open(b).convert("RGB")).astype(int)
    eq = x.shape == y.shape and np.array_equal(x, y)
    print(f"{'IDENTICAL' if eq else 'DIFFERENT'} {a} vs {b}" + ("" if eq else f" maxdiff={np.abs(x - y).max()} ndiff={(np.abs(x - y).sum(-1) > 0).sum()}"))
    return eq


def side(ref, mine, out):
    r = Image.open(ref).convert("RGB").resize((960, 540), Image.LANCZOS)
    m = Image.open(mine).convert("RGB").resize((960, 540), Image.LANCZOS)
    c = Image.new("RGB", (1924, 540), (255, 255, 255))
    c.paste(r, (0, 0))
    c.paste(m, (964, 0))
    c.save(out)


if __name__ == "__main__":
    cmd = sys.argv[1]
    if cmd == "probe":
        sys.exit(0 if probe(sys.argv[2:]) else 1)
    elif cmd == "sheet":
        sheet(sys.argv[2], sys.argv[3])
    elif cmd == "banding":
        banding(sys.argv[2], int(sys.argv[3]), sys.argv[4:])
    elif cmd == "same":
        sys.exit(0 if same(sys.argv[2], sys.argv[3]) else 1)
    elif cmd == "side":
        side(sys.argv[2], sys.argv[3], sys.argv[4])
    elif cmd == "frame":
        Image.fromarray(frame(sys.argv[2], int(sys.argv[3]))).save(sys.argv[4])
