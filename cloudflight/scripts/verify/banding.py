# Step 4: banding check on a frame decoded from the encoded mp4.
# Down three vertical lines, find smooth-gradient stretches (9-px mean slope
# < 0.6 levels/px over >= 40 px) and report the longest run of identical raw
# 8-bit values inside them. Without dither, a slow gradient shows long flat
# runs ending in 1-level steps (bands); with working dither/grain the runs stay
# a few pixels long.
import subprocess, sys
import numpy as np
mp4, t = sys.argv[1], sys.argv[2]
raw = subprocess.run(["ffmpeg", "-v", "error", "-ss", t, "-i", mp4, "-frames:v", "1", "-f", "rawvideo",
                      "-pix_fmt", "rgb24", "-"], capture_output=True).stdout
img = np.frombuffer(raw, np.uint8).reshape(720, 1280, 3).astype(int)
worst = 0
for x in (200, 640, 1080):
    col = img[:, x, :]
    lum = (col[:, 0] * 2 + col[:, 1] * 5 + col[:, 2]) // 8
    sm = np.convolve(lum, np.ones(9) / 9, mode="same")
    slow = np.abs(np.gradient(sm)) < 0.6
    longest, smooth_px, run, i = 0, 0, 1, 0
    # stretches of slow gradient
    segs, start = [], None
    for y in range(4, 716):
        if slow[y] and start is None: start = y
        if (not slow[y] or y == 715) and start is not None:
            if y - start >= 40: segs.append((start, y))
            start = None
    for a, b in segs:
        smooth_px += b - a
        for c in range(3):
            v = col[a:b, c]; run = 1
            for k in range(1, len(v)):
                # Near-black (<= 8 of 255, i.e. < ~3 %) is flat by design (grain fades out below
                # 3 % luminance; dither clamps at 0) - not a band.
                run = run + 1 if v[k] == v[k - 1] and v[k] > 8 else 1
                longest = max(longest, run)
    worst = max(worst, longest)
    print(f"  x={x}: smooth stretch {smooth_px:3d}px, longest identical-value run {longest}px")
print(f"  RESULT longest run {worst}px -> {'OK (no bands)' if worst <= 12 else 'CHECK'}")
