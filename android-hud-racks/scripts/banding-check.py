#!/usr/bin/env python3
"""Step 4: reads pixel values from frames decoded out of the encoded mp4s and
checks that soft gradients change smoothly.

For each probe line it reports:
  - plateau: the longest run of identical raw values (long flat runs next to
    jumps are what banding looks like; grain should keep runs short),
  - jump: the largest step between neighbours after a 15 px box smoothing
    (a smooth gradient changes by a fraction of a code value per pixel).
A line passes when plateau <= 12 px and jump <= 1.5.
"""
import subprocess, sys, os
from PIL import Image

OUT = sys.argv[1] if len(sys.argv) > 1 else "out"
# (file, time s, label, (x0, y0, x1, y1)) - horizontal or vertical probe lines
PROBES = [
    ("AndroidTraderHUD_Left", 3.0, "HUD background, lower right (horizontal)", (700, 700, 1270, 700)),
    ("AndroidTraderHUD_Left", 3.0, "HUD background, right edge (vertical)", (1270, 300, 1270, 520)),
    ("AndroidTraderHUD_Left", 3.0, "HUD background, under the gauge (vertical)", (1000, 640, 1000, 715)),
    ("AndroidTraderHUD_Left", 3.0, "eye glow, halo above the right eye (vertical)", (297, 8, 297, 66)),
    ("AndroidTraderHUD_Right", 3.0, "HUD background, lower left (horizontal)", (10, 700, 560, 700)),
    ("GrowthChartHUD_Story", 13.0, "chart blue gradient, right side (vertical)", (1150, 200, 1150, 420)),
    ("GrowthChartHUD_Story", 13.0, "chart blue gradient, under the chart (vertical)", (450, 470, 450, 500)),
    ("GrowthChartHUD_Story", 13.0, "chart blue gradient, bottom (horizontal)", (640, 690, 1270, 690)),
    ("ServerRack_FrontScroll", 5.0, "rack metal soft highlight", "highlight"),
    ("ServerRack_DiagonalGlide", 5.0, "rack metal soft highlight", "highlight"),
    ("ServerRack_LowAngle", 5.0, "rack dark shadow to highlight", "highlight"),
]

def frame(name, t):
    path = f"{OUT}/banding/{name}-{t:.1f}.png"
    os.makedirs(f"{OUT}/banding", exist_ok=True)
    if not os.path.exists(path):
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", str(t), "-i", f"{OUT}/{name}.mp4",
                        "-frames:v", "1", path], check=True)
    return Image.open(path).convert("RGB")

def luma(p):
    return 0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2]

def line(img, x0, y0, x1, y1):
    n = max(abs(x1 - x0), abs(y1 - y0)) + 1
    return [img.getpixel((round(x0 + (x1 - x0) * i / (n - 1)), round(y0 + (y1 - y0) * i / (n - 1)))) for i in range(n)]

def analyse(vals):
    lum = [luma(p) for p in vals]
    raw = [tuple(p) for p in vals]
    run = best = 1
    for i in range(1, len(raw)):
        run = run + 1 if raw[i] == raw[i - 1] else 1
        best = max(best, run)
    k = 7
    sm = [sum(lum[max(0, i - k):i + k + 1]) / len(lum[max(0, i - k):i + k + 1]) for i in range(len(lum))]
    jump = max(abs(sm[i] - sm[i - 1]) for i in range(k + 1, len(sm) - k)) if len(sm) > 2 * k + 2 else 0
    return best, jump, min(lum), max(lum)

def find_eye(img):
    w, h = img.size
    best, bp = -1, (0, 0)
    for y in range(0, h // 3):
        for x in range(0, w // 2, 2):
            r, g, b = img.getpixel((x, y))
            s = b - r
            if s > best and b > 150:
                best, bp = s, (x, y)
    x, y = bp
    return (max(0, x - 70), y + 22, min(w - 1, x + 70), y + 22)

def find_highlight(img):
    # The row whose 300 px window has the widest smooth luminance ramp.
    w, h = img.size
    best, pick = -1, None
    for y in range(40, h - 40, 20):
        for x in range(0, w - 300, 100):
            v = [luma(img.getpixel((x + i, y))) for i in range(0, 300, 10)]
            rng = max(v) - min(v)
            rough = sum(abs(v[i] - v[i - 1]) for i in range(1, len(v)))
            score = rng - 1.5 * max(0, rough - 1.4 * rng)
            if score > best:
                best, pick = score, (x, y, x + 299, y)
    return pick

ok_all = True
for name, t, label, probe in PROBES:
    if not os.path.exists(f"{OUT}/{name}.mp4"):
        print(f"{name}: missing mp4"); continue
    img = frame(name, t)
    if probe == "eye": probe = find_eye(img)
    if probe == "highlight": probe = find_highlight(img)
    plateau, jump, lo, hi = analyse(line(img, *probe))
    ok = plateau <= 12 and jump <= 1.5
    ok_all &= ok
    print(f"{'PASS' if ok else 'FAIL'}  {name} @{t}s  {label}  line={probe}  luma {lo:.0f}-{hi:.0f}  longest flat run={plateau}px  max smoothed step={jump:.2f}")
print("ALL PASS" if ok_all else "SOME FAILED")
