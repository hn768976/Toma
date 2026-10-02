#!/usr/bin/env python3
"""Checks on the ENCODED previews (not the browser preview).

  python3 tools/check-encoded.py            # needs ffmpeg/ffprobe, numpy, Pillow

1. ffprobe: 1920x1080, 30/1, 20.0 s, h264, yuv420p, no audio stream.
2. Look 2: empty pixels decode to exactly 0,0,0 (sampled in 5 frames).
3. Banding: for 1B and look 4, a contrast-stretched crop of a smooth
   gradient area is written to renders/banding/ for visual inspection, and
   the grain level (std-dev of the high-pass residual) is reported.
"""
import json
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
PREV = ROOT / "renders" / "previews"
NAMES = [
    "SecurityDashboard_Dark", "SecurityDashboard_Light", "MinimalHUD_White", "MinimalHUD_Amber",
    "AIInterfaceCode_Mono", "AIInterfaceCode_Blue", "PadlockGrid_Secure", "PadlockGrid_Breach",
    "AIInterfaceAssistant_Mono", "AIInterfaceAssistant_Blue",
]


def frame(path: Path, n: int) -> np.ndarray:
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", str(path), "-vf", f"select=eq(n\\,{n})", "-frames:v", "1",
         "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
        capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.uint8).reshape(1080, 1920, 3)


ok = True
print("== 1. ffprobe")
for name in NAMES:
    p = PREV / f"{name}.mp4"
    info = json.loads(subprocess.run(
        ["ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", str(p)],
        capture_output=True, check=True).stdout)
    v = [s for s in info["streams"] if s["codec_type"] == "video"]
    a = [s for s in info["streams"] if s["codec_type"] == "audio"]
    s = v[0]
    dur = float(info["format"]["duration"])
    good = (s["width"], s["height"]) == (1920, 1080) and s["r_frame_rate"] == "30/1" and abs(dur - 20.0) < 1e-6 \
        and s["codec_name"] == "h264" and s["pix_fmt"] == "yuv420p" and not a and int(s["nb_frames"]) == 600
    ok &= good
    print(f"{'PASS' if good else 'FAIL'}  {name}: {s['width']}x{s['height']} {s['r_frame_rate']} {dur:.3f}s "
          f"{s['codec_name']} {s['pix_fmt']} frames={s['nb_frames']} audio_streams={len(a)}")

print("== 2. look 2 pure black")
# empty regions of the HUD layout (design units = 1080p pixels)
EMPTY = [(0, 0, 10, 10), (190, 950, 420, 985), (1250, 650, 1460, 700), (1780, 870, 1850, 930)]
for name in ["MinimalHUD_White", "MinimalHUD_Amber"]:
    worst = 0
    for n in [0, 150, 300, 450, 599]:
        f = frame(PREV / f"{name}.mp4", n)
        for x0, y0, x1, y1 in EMPTY:
            worst = max(worst, int(f[y0:y1, x0:x1].max()))
    zero = float((frame(PREV / f"{name}.mp4", 300).max(axis=2) == 0).mean())
    good = worst == 0
    ok &= good
    print(f"{'PASS' if good else 'FAIL'}  {name}: max value in empty regions over 5 frames = {worst}; "
          f"{100 * zero:.1f}% of all pixels in frame 300 are exactly 0,0,0")

print("== 3. grain / banding")
out = ROOT / "renders" / "banding"
out.mkdir(parents=True, exist_ok=True)
# (name, frame, crop x0,y0,x1,y1) - smooth areas: 1B page background, look 4 light leak + gradient
CROPS = [("SecurityDashboard_Light", 300, (750, 96, 846, 128)), ("SecurityDashboard_Light", 300, (40, 1066, 440, 1080)),
         ("PadlockGrid_Secure", 300, (0, 0, 1920, 1080)), ("PadlockGrid_Breach", 300, (0, 0, 1920, 1080))]
for name, n, (x0, y0, x1, y1) in CROPS:
    f = frame(PREV / f"{name}.mp4", n).astype(float)
    c = f[y0:y1, x0:x1].mean(axis=2)
    # high-pass residual = grain
    k = 5
    pad = np.pad(c, k, mode="edge")
    blur = sum(pad[k + dy:k + dy + c.shape[0], k + dx:k + dx + c.shape[1]] for dy in range(-k, k + 1) for dx in range(-k, k + 1)) / (2 * k + 1) ** 2
    res = c - blur
    # median of per-block std-devs: robust to padlocks, tags and text in the crop
    b = 8 if min(c.shape) < 32 else 16
    stds = [res[y:y + b, x:x + b].std() for y in range(0, res.shape[0] - b + 1, b) for x in range(0, res.shape[1] - b + 1, b)]
    g = float(np.median(stds))
    print(f"      {name} f{n} crop {x0},{y0}-{x1},{y1}: mean {c.mean():.1f}, grain std (median of {b}px blocks) "
          f"{g:.2f} code values ({100 * g / 255:.2f}% of full scale)")
    lo, hi = np.percentile(c, 1), np.percentile(c, 99)
    st = np.clip((c - lo) / max(1, hi - lo) * 255, 0, 255).astype(np.uint8)
    Image.fromarray(st).save(out / f"{name}_f{n}_{x0}_{y0}_stretched.png")

sys.exit(0 if ok else 1)
