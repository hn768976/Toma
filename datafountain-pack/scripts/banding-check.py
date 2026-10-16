#!/usr/bin/env python3
"""Step 4 — banding check on the ENCODED mp4s.

Extracts one frame from each preview with ffmpeg, then reads luma along
lines through the gradient areas named in the brief. Each profile is
averaged across a 24-px-wide strip (so grain/dither average out, as the eye
does) and sampled every pixel. Banding shows up as plateaus separated by
steps: we report the largest jump between neighbouring 4-px bins and the
longest run of identical rounded values. Smooth = max jump ≤ 1.5 levels.
usage: banding-check.py RENDER_DIR
"""
import subprocess, sys, os
import numpy as np
from PIL import Image

R = sys.argv[1]
# (preview, frame, [(name, (x0,y0,x1,y1)) line in 1280x720 coords])
AREAS = {
    "DataFountain_Loop": (300, [("navy glow / sky, vertical", (200, 0, 200, 300)), ("dark floor, horizontal", (0, 690, 1280, 690))]),
    "DataFountain_Story": (225, [("navy sky, vertical", (1100, 0, 1100, 250))]),
    "CodePanels_Dark": (300, [("black around flare, horizontal", (40, 396, 700, 396)), ("flare falloff, vertical", (30, 200, 30, 600))]),
    "PastelSilk_PinkBlue": (300, [("pastel gradient, horizontal", (0, 600, 1280, 600)), ("pastel gradient, vertical", (900, 0, 900, 720))]),
    "PastelSilk_PeachMint": (300, [("pastel gradient, horizontal", (0, 600, 1280, 600)), ("pastel gradient, vertical", (900, 0, 900, 720))]),
    "TealHUD_Soft": (300, [("teal mist diagonal-ish, horizontal", (0, 700, 1280, 700)), ("teal mist, vertical", (1240, 0, 1240, 720))]),
    "LiquidRipples_White": (300, [("white liquid centre dish, horizontal", (480, 360, 800, 360))]),
    "LiquidRipples_Black": (300, [("black ink centre dish, horizontal", (480, 360, 800, 360))]),
}

def frame(name, f):
    out = f"/tmp/band_{name}_{f}.png"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", os.path.join(R, "previews", name + ".mp4"),
                    "-vf", f"select=eq(n\\,{f})", "-frames:v", "1", out], check=True)
    return np.asarray(Image.open(out).convert("RGB")).astype(np.float64)

def profile(img, line, half=12):
    x0, y0, x1, y1 = line
    lum = img @ np.array([0.2126, 0.7152, 0.0722])
    if y0 == y1:
        strip = lum[max(0, y0 - half):y0 + half, x0:x1]
        return strip.mean(axis=0)
    strip = lum[y0:y1, max(0, x0 - half):x0 + half]
    return strip.mean(axis=1)

ok = True
for name, (f, lines) in AREAS.items():
    img = frame(name, f)
    for label, line in lines:
        p = profile(img, line)
        bins = p[: len(p) // 4 * 4].reshape(-1, 4).mean(axis=1)
        jumps = np.abs(np.diff(bins))
        r = np.round(p)
        run, best = 1, 1
        for a, b in zip(r[:-1], r[1:]):
            run = run + 1 if a == b else 1
            best = max(best, run)
        verdict = "smooth" if jumps.max() <= 1.5 else "CHECK"
        ok &= verdict == "smooth"
        print(f"{name:22s} f{f:<4d} {label:38s} range {p.min():6.1f}-{p.max():6.1f}  "
              f"max 4px-bin jump {jumps.max():4.2f}  longest flat run {best:3d}px  -> {verdict}")
print("ALL SMOOTH" if ok else "SOME PROFILES NEED A LOOK (steps may be real content edges)")
