"""Banding detector.

Reads a frame extracted from the ENCODED mp4 and looks for quantisation
plateaus inside SHALLOW GRADIENTS, which is where 8-bit banding actually
shows. Flat fills are excluded: a panel interior that holds one value for
600px is not a band, it is a fill, and an earlier version of this script
produced nothing but false positives by counting those.

Method, per scanline:
  1. Smooth the row to recover the underlying ramp.
  2. Keep the segments where the ramp is shallow -- between 1/400 and 1/12 of
     a level per pixel -- AND where the raw line has no hard edge in it. The
     edge guard matters: smoothing across a panel border invents a ramp that
     is not there, and the flat fills either side of it then look like
     enormous plateaus. That produced ratios above 1 on the dashboards, which
     is impossible for a real band, since a band cannot be wider than its own
     quantisation step.
  3. In each such segment the UNDITHERED step width is 1/gradient pixels.
     Measure the median run of identical raw values and compare.

     ratio = median_run / expected_step

     Near 1.0 the quantisation steps survive intact -- that is a band.
     Near 0 the dither has broken them up, which is what we want.

Two scanlines are tested: the smoothest row in the frame (background) and the
brightest (through a glow halo, the worst case for a dark composition).
"""
import subprocess
import statistics
import sys

path, name = sys.argv[1], sys.argv[2]
raw = subprocess.run(
    ["ffmpeg", "-v", "error", "-i", path, "-f", "rawvideo", "-pix_fmt", "gray", "-"],
    capture_output=True,
).stdout
W, H = 1920, 1080
rows = [raw[y * W : (y + 1) * W] for y in range(H)]

SMOOTH = 81
LO_G, HI_G = 1.0 / 400, 1.0 / 12   # levels per pixel


def smooth(line):
    out, acc, k = [], 0, SMOOTH // 2
    pref = [0]
    for v in line:
        pref.append(pref[-1] + v)
    for i in range(len(line)):
        a, b = max(0, i - k), min(len(line), i + k + 1)
        out.append((pref[b] - pref[a]) / (b - a))
    return out


def runs_in(line, a, b):
    out, cur, n = [], line[a], 1
    for v in line[a + 1 : b]:
        if v == cur:
            n += 1
        else:
            out.append(n)
            cur, n = v, 1
    out.append(n)
    return out


def analyse(line):
    sm = smooth(line)
    worst = None
    step = 60
    for a in range(0, W - step * 4, step):
        b = a + step * 4
        g = abs(sm[b - 1] - sm[a]) / (b - a)
        if not (LO_G <= g <= HI_G):
            continue
        seg = line[a:b]
        # Hard edge in the segment => this is a border, not a gradient.
        if max(abs(seg[i + 1] - seg[i]) for i in range(len(seg) - 1)) > 3:
            continue
        # No transition inside the segment => it is a flat fill, and the only
        # reason it looks like a ramp is the smoothing window reaching into
        # whatever sits next to it. A ramp has to actually change here.
        if len(set(seg)) < 3:
            continue
        expected = 1.0 / g
        med = statistics.median(runs_in(line, a, b))
        if med >= (b - a) * 0.9:
            continue
        ratio = med / expected
        if worst is None or ratio > worst[0]:
            worst = (ratio, med, expected, a)
    return worst


tv = [(sum(abs(r[i + 1] - r[i]) for i in range(0, W - 1, 4)), y) for y, r in enumerate(rows)]
smooth_y = min(tv)[1]
bright_y = max(range(H), key=lambda y: sum(rows[y][::8]))

verdict, parts = "PASS", []
for label, y in (("bg", smooth_y), ("halo", bright_y)):
    r = analyse(rows[y])
    if r is None:
        parts.append(f"{label} y={y}: no shallow ramp on this line")
        continue
    ratio, med, expected, at = r
    if ratio > 0.5:
        verdict = "FAIL"
    parts.append(
        f"{label} y={y}: worst ratio {ratio:.2f} "
        f"(median run {med:.0f}px vs {expected:.0f}px undithered, at x={at})"
    )
print(f"{verdict}  {name:<26} " + " | ".join(parts))
