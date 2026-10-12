#!/usr/bin/env python3
"""Verification helpers for the 720p previews (steps 1-6 of the verify loop).

Usage:
  python3 scripts/verify.py probe <mp4>...           # step 1
  python3 scripts/verify.py same <a.png> <b.png>     # pixel + byte identity
  python3 scripts/verify.py seam <framesDir>         # loop seam continuity (599 -> 0)
  python3 scripts/verify.py band <mp4> <frame> <x0> <y0> <x1> <y1> <out.png>  # step 4
  python3 scripts/verify.py sheet <mp4> <frames> <out.png>                    # step 5
"""
import hashlib
import json
import subprocess
import sys

import numpy as np
from PIL import Image


def probe(paths):
    ok = True
    for p in paths:
        out = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries",
             "stream=codec_type,codec_name,width,height,r_frame_rate,pix_fmt",
             "-show_entries", "format=duration", "-of", "json", p],
            capture_output=True, text=True, check=True).stdout
        j = json.loads(out)
        streams = j["streams"]
        v = [s for s in streams if s["codec_type"] == "video"]
        a = [s for s in streams if s["codec_type"] == "audio"]
        s = v[0]
        dur = float(j["format"]["duration"])
        good = (len(v) == 1 and not a and s["codec_name"] == "h264" and s["width"] == 1280 and s["height"] == 720
                and s["r_frame_rate"] == "30/1" and s["pix_fmt"] == "yuv420p")
        print(f"{p}: {s['codec_name']} {s['width']}x{s['height']} {s['r_frame_rate']} {s['pix_fmt']} "
              f"audio_streams={len(a)} duration={dur:.3f}s -> {'OK' if good else 'FAIL'}")
        ok &= good
    return ok


def same(a, b):
    A = np.asarray(Image.open(a).convert("RGB"), dtype=np.int16)
    B = np.asarray(Image.open(b).convert("RGB"), dtype=np.int16)
    d = np.abs(A - B)
    ha = hashlib.sha256(open(a, "rb").read()).hexdigest()[:16]
    hb = hashlib.sha256(open(b, "rb").read()).hexdigest()[:16]
    print(f"pixels_identical={bool(d.max() == 0)} max_diff={int(d.max())} differing_px={int((d.max(axis=2) > 0).sum())} "
          f"bytes_identical={ha == hb} ({ha} vs {hb})")
    return d.max() == 0


def frame(path_or_mp4, n=None):
    if n is None:
        return np.asarray(Image.open(path_or_mp4).convert("RGB"), dtype=np.float32)
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path_or_mp4, "-vf", f"select=eq(n\\,{n})",
                          "-vframes", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.uint8).reshape(720, 1280, 3).astype(np.float32)


def seam(d):
    import os
    files = sorted(f for f in os.listdir(d) if f.endswith(".png"))
    n = len(files)
    F = lambda i: frame(os.path.join(d, files[i % n]))
    # Mean abs difference between consecutive frames near the seam vs. the seam itself.
    diffs = {f"{n-3}->{n-2}": np.abs(F(n - 3) - F(n - 2)).mean(),
             f"{n-2}->{n-1}": np.abs(F(n - 2) - F(n - 1)).mean(),
             f"{n-1}->0 (seam)": np.abs(F(n - 1) - F(0)).mean(),
             "0->1": np.abs(F(0) - F(1)).mean(),
             "1->2": np.abs(F(1) - F(2)).mean()}
    for k, v in diffs.items():
        print(f"  {k}: {v:.3f}")
    vals = list(diffs.values())
    seam_v = vals[2]
    others = vals[:2] + vals[3:]
    ratio = seam_v / max(1e-6, float(np.mean(others)))
    print(f"  seam/neighbour ratio = {ratio:.2f} -> {'OK' if ratio < 1.5 else 'CHECK'}")
    return ratio < 1.5


def band(mp4, n, x0, y0, x1, y1, out):
    img = frame(mp4, int(n))
    crop = img[int(y0):int(y1), int(x0):int(x1)]
    lum = crop.mean(axis=2)
    # Profile along the longer axis, averaged across the other (removes grain).
    horiz = (x1 - x0) >= (y1 - y0)
    prof = lum.mean(axis=0 if horiz else 1)
    d = np.diff(prof)
    # Banding = flat runs separated by jumps. Look at the averaged profile's
    # steps relative to its local slope.
    steps = np.abs(d)
    print(f"  profile min={prof.min():.2f} max={prof.max():.2f} mean|step|={steps.mean():.3f} max|step|={steps.max():.3f}")
    # Raw 8-bit values present in the crop: dithered/grained areas use many.
    vals = np.unique(crop.astype(np.uint8)[..., 2])
    print(f"  distinct blue levels in crop: {len(vals)} (range {vals.min()}..{vals.max()})")
    # Contrast-stretched view for eyeballing contours.
    s = (lum - lum.min()) / max(1e-6, lum.max() - lum.min()) * 255
    Image.fromarray(s.astype(np.uint8)).resize((min(1280, s.shape[1] * 2), min(720, s.shape[0] * 2))).save(out)
    print("  profile:", " ".join(f"{v:.1f}" for v in prof[:: max(1, len(prof) // 24)]))
    return steps.max() < 1.5


def sheet(mp4, frames, out):
    idx = [int(x) for x in frames.split(",")]
    tiles = [Image.fromarray(frame(mp4, i).astype(np.uint8)).resize((512, 288)) for i in idx]
    o = Image.new("RGB", (512 * len(tiles), 288))
    for k, t in enumerate(tiles):
        o.paste(t, (512 * k, 0))
    o.save(out)


if __name__ == "__main__":
    cmd, *args = sys.argv[1:]
    r = {"probe": lambda: probe(args), "same": lambda: same(*args), "seam": lambda: seam(*args),
         "band": lambda: band(*args), "sheet": lambda: sheet(*args)}[cmd]()
    sys.exit(0 if r in (None, True) else 1)
