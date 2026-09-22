"""Banding detector.

Reads a frame extracted from the ENCODED mp4, takes a horizontal scanline
through the smoothest background region and a second through the brightest
glow halo, and looks for stepped plateaus: long runs of one value inside a
ramp that is only drifting by a level at a time. Smooth dithered gradients
break into short runs; banded ones do not.
"""
import subprocess, sys, statistics

path, name = sys.argv[1], sys.argv[2]
raw = subprocess.run(
    ["ffmpeg", "-v", "error", "-i", path, "-f", "rawvideo", "-pix_fmt", "gray", "-"],
    capture_output=True).stdout
W, H = 1920, 1080
rows = [raw[y * W:(y + 1) * W] for y in range(H)]


def runs(line):
    out, cur, n = [], line[0], 1
    for v in line[1:]:
        if v == cur:
            n += 1
        else:
            out.append(n); cur, n = v, 1
    out.append(n)
    return out


def score(line):
    span = max(line) - min(line)
    if span < 2:
        return None          # flat area, nothing to band
    r = runs(line)
    return span, max(r), statistics.median(r)


# smoothest row: lowest total variation; brightest row: highest mean
tv = [(sum(abs(r[i + 1] - r[i]) for i in range(0, W - 1, 4)), y) for y, r in enumerate(rows)]
smooth_y = min(tv)[1]
bright_y = max(range(H), key=lambda y: sum(rows[y][::8]))

verdict = "PASS"
parts = []
for label, y in (("bg", smooth_y), ("halo", bright_y)):
    s = score(rows[y])
    if s is None:
        parts.append(f"{label} y={y} flat")
        continue
    span, longest, med = s
    # A plateau wider than 60px inside a shallow ramp is a visible band.
    if longest > 60 and span < 40:
        verdict = "FAIL"
    parts.append(f"{label} y={y} span={span} longest_plateau={longest}px median_run={med}px")
print(f"{verdict}  {name:<26} " + " | ".join(parts))
