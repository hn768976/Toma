#!/usr/bin/env python3
"""Checks the encoded previews (README "Verification", steps 1, 4 and 6).

    python3 scripts/check-output.py [out/previews]

- ffprobe: 1280x720, 30/1, 20.0 s, h264, yuv420p, no audio stream.
- Banding: frames decoded from the mp4 (not the render), profiles read
  across the main gradient of each look. A banded gradient shows long runs
  of one 8-bit value and visible steps; a dithered one shows short runs and
  a smooth averaged profile.
- Exposure: Particle Smoke must never go near-black and its brightest folds
  must not clip to flat colour; Cream Swirl must not clip to white except in
  the top-left gap.
- Five evenly spaced frames per clip are saved as a contact sheet.
"""
import json
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image

DIR = Path(sys.argv[1] if len(sys.argv) > 1 else "out/previews")
SHEETS = DIR.parent / "contact"
SHEETS.mkdir(parents=True, exist_ok=True)


def probe(f):
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "stream=codec_type,codec_name,width,height,r_frame_rate,pix_fmt",
         "-show_entries", "format=duration", "-of", "json", str(f)],
        capture_output=True, text=True, check=True).stdout
    return json.loads(out)


def frame(f, t):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{t:.3f}", "-i", str(f), "-frames:v", "1",
                          "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.uint8).reshape(720, 1280, 3)


def profile_stats(img, p0, p1, width=12):
    """Luma along p0->p1: raw run lengths and the averaged profile's largest step."""
    n = int(np.hypot(p1[0] - p0[0], p1[1] - p0[1]))
    xs = np.linspace(p0[0], p1[0], n).astype(int)
    ys = np.linspace(p0[1], p1[1], n).astype(int)
    luma = img[..., 0] * 0.299 + img[..., 1] * 0.587 + img[..., 2] * 0.114
    raw = np.round(luma[ys, xs]).astype(int)
    runs, cur = [], 1
    for a, b in zip(raw[:-1], raw[1:]):
        if a == b:
            cur += 1
        else:
            runs.append(cur)
            cur = 1
    runs.append(cur)
    # average across the profile direction to remove grain, then look for steps
    d = np.array([p1[1] - p0[1], p0[0] - p1[0]], float)
    d /= np.linalg.norm(d)
    acc = np.zeros(n)
    for k in range(-width // 2, width // 2):
        xx = np.clip((xs + d[0] * k).astype(int), 0, 1279)
        yy = np.clip((ys + d[1] * k).astype(int), 0, 719)
        acc += luma[yy, xx]
    acc /= width
    sm = np.convolve(acc, np.ones(9) / 9, mode="valid")
    second = np.abs(np.diff(sm, 2)).max() if len(sm) > 3 else 0
    return {"levels": int(len(set(raw))), "longest_run": int(max(runs)), "mean_run": round(float(np.mean(runs)), 2),
            "range": [int(raw.min()), int(raw.max())], "max_curvature": round(float(second), 3)}


ok_all = True
for f in sorted(DIR.glob("*.mp4")):
    name = f.stem
    info = probe(f)
    streams = info["streams"]
    v = [s for s in streams if s["codec_type"] == "video"][0]
    audio = [s for s in streams if s["codec_type"] == "audio"]
    dur = float(info["format"]["duration"])
    basic = (v["width"], v["height"]) == (1280, 720) and v["r_frame_rate"] == "30/1" and abs(dur - 20.0) < 0.05 \
        and v["codec_name"] == "h264" and v["pix_fmt"] == "yuv420p" and not audio
    print(f"\n== {name}: {v['width']}x{v['height']} {v['r_frame_rate']} {dur:.3f}s {v['codec_name']} {v['pix_fmt']} "
          f"audio streams: {len(audio)} -> {'PASS' if basic else 'FAIL'}")
    ok_all &= basic

    times = [0.5, 4.5, 9.5, 14.5, 19.4]
    frames = [frame(f, t) for t in times]
    sheet = Image.new("RGB", (5 * 384, 216))
    for i, fr in enumerate(frames):
        sheet.paste(Image.fromarray(fr).resize((384, 216)), (i * 384, 0))
    sheet.save(SHEETS / f"{name}.png")

    img = frames[2]
    if name.startswith("VintageMap"):
        lines = {"vignette centre->top-left": ((640, 360), (5, 5)), "vignette centre->bottom-right": ((640, 360), (1274, 714))}
    elif name.startswith("CreamSwirl"):
        lines = {"surface left->right": ((5, 500), (1274, 500)), "surface top->bottom": ((900, 5), (900, 714))}
    else:
        lines = {"background right edge top->bottom": ((1260, 5), (1260, 714)), "background top-left->corner": ((300, 40), (5, 5))}
    for label, (a, b) in lines.items():
        st = profile_stats(img, a, b)
        smooth = st["longest_run"] <= 12 and st["max_curvature"] < 3.0
        print(f"  banding {label}: {st} -> {'smooth' if smooth else 'CHECK'}")
        ok_all &= smooth

    luma_all = [fr[..., 0] * 0.299 + fr[..., 1] * 0.587 + fr[..., 2] * 0.114 for fr in frames]
    if name.startswith("ParticleSmoke"):
        for t, fr, l in zip(times, frames, luma_all):
            bright_share = float((l > 60).mean())
            p999 = np.percentile(fr.reshape(-1, 3), 99.9, axis=0)
            flat = float((fr.max(axis=2) >= 254).mean())
            good = bright_share > 0.03 and flat < 0.001
            print(f"  t={t:4.1f}s form pixels(luma>60) {bright_share:.3f}, 99.9th pct RGB {p999.astype(int).tolist()}, "
                  f"clipped {flat:.5f} -> {'PASS' if good else 'FAIL'}")
            ok_all &= good
    if name.startswith("CreamSwirl"):
        for t, fr in zip(times, frames):
            white = fr.min(axis=2) >= 254
            outside = white.copy()
            outside[:300, :500] = False  # the top-left gap may go to white
            good = outside.mean() < 0.0005
            print(f"  t={t:4.1f}s pure-white pixels {white.mean():.4f} (outside the top-left gap {outside.mean():.5f}) "
                  f"-> {'PASS' if good else 'FAIL'}")
            ok_all &= good

print("\nALL PASS" if ok_all else "\nSOME CHECKS FAILED")
sys.exit(0 if ok_all else 1)
