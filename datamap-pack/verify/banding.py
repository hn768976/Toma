"""Step 4: banding check on frames decoded from the encoded mp4s.

For each sampled line we report, per channel, the value range, the longest run
of an identical raw 8-bit value, and the largest jump of the line after a
31-px running median (which removes thin lines/text and the grain/dither).
A banded gradient shows long identical runs and median jumps >= 1 level at
band edges; a smooth one has short runs and sub-level median steps.
"""
import subprocess, sys, os, statistics
from PIL import Image

LINES = {
    "SoftGradient_Lime": [("row 180", (0, 180), (1279, 180)), ("row 540", (0, 540), (1279, 540)), ("diagonal", (0, 0), (1279, 719))],
    "SoftGradient_Peach": [("row 180", (0, 180), (1279, 180)), ("row 540", (0, 540), (1279, 540)), ("diagonal", (0, 0), (1279, 719))],
    "WirePeaks_White": [("row 40", (0, 40), (1279, 40)), ("col 640 top", (640, 0), (640, 200))],
    "WirePeaks_Cyan": [("row 40", (0, 40), (1279, 40)), ("col 640 top", (640, 0), (640, 200))],
    "PlexusGlobe_Navy": [("row 360 right", (860, 360), (1279, 360)), ("col 1150", (1150, 0), (1150, 719))],
    "DataMap_Blue": [("col 60", (60, 0), (60, 719)), ("row 20", (0, 20), (1279, 20))],
    "CircuitWarp_Violet": [("row 360", (0, 360), (1279, 360)), ("col 640", (640, 0), (640, 719))],
}

def sample(im, a, b):
    (x0, y0), (x1, y1) = a, b
    n = max(abs(x1 - x0), abs(y1 - y0)) + 1
    return [im.getpixel((round(x0 + (x1 - x0) * i / (n - 1)), round(y0 + (y1 - y0) * i / (n - 1)))) for i in range(n)]

def runmed(v, w=31):
    h = w // 2
    return [statistics.median(v[max(0, i - h): i + h + 1]) for i in range(len(v))]

def longest_run(v):
    best = cur = 1
    for i in range(1, len(v)):
        cur = cur + 1 if v[i] == v[i - 1] else 1
        best = max(best, cur)
    return best

frame = int(sys.argv[1]) if len(sys.argv) > 1 else 300
os.makedirs("out/verify/banding", exist_ok=True)
for name, lines in LINES.items():
    mp4 = f"out/previews/{name}.mp4"
    png = f"out/verify/banding/{name}-{frame}.png"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", mp4, "-vf", f"select=eq(n\\,{frame})", "-frames:v", "1", png], check=True)
    im = Image.open(png).convert("RGB")
    for label, a, b in lines:
        px = sample(im, a, b)
        out = []
        for c, ch in enumerate("RGB"):
            v = [p[c] for p in px]
            m = runmed(v)
            jump = max(abs(m[i] - m[i - 1]) for i in range(1, len(m)))
            out.append(f"{ch}:{min(v)}-{max(v)} run{longest_run(v)} medjump{jump:g}")
        print(f"{name:20s} {label:14s} " + " | ".join(out))
