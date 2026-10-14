"""Banding check on the *encoded* mp4 (not the preview).

Extracts one frame with ffmpeg, then reads pixel values along lines through
the background glow and the floor light pool. Each profile is smoothed with a
9-px box (the dither/grain is per-pixel noise by design); banding shows up as
flat plateaus joined by jumps, so we report the largest jump between
neighbouring smoothed samples (in 8-bit code values) and the longest flat
run. Smooth gradients have jumps well under 1 code value.

usage: python3 scripts/banding-check.py <file.mp4> <frame> [out.png]
"""
import subprocess, sys
from PIL import Image

src, frame = sys.argv[1], int(sys.argv[2])
png = sys.argv[3] if len(sys.argv) > 3 else "/tmp/banding-frame.png"
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", src, "-vf", f"select=eq(n\\,{frame})", "-frames:v", "1", png], check=True)
im = Image.open(png).convert("RGB")
W, H = im.size

def luma(p):
    return 0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2]

lines = {
    "left glow, vertical (x=6%)": [(int(0.06 * W), y) for y in range(int(0.05 * H), int(0.97 * H))],
    "upper background, horizontal (y=10%)": [(x, int(0.10 * H)) for x in range(int(0.02 * W), int(0.98 * W))],
    "floor pool, horizontal (y=93%)": [(x, int(0.93 * H)) for x in range(int(0.02 * W), int(0.98 * W))],
    "right side, vertical (x=94%)": [(int(0.94 * W), y) for y in range(int(0.05 * H), int(0.97 * H))],
}
worst = 0.0
for name, pts in lines.items():
    v = [luma(im.getpixel(p)) for p in pts]
    k = 9
    sm = [sum(v[i - k // 2 : i + k // 2 + 1]) / k for i in range(k // 2, len(v) - k // 2)]
    jumps = [abs(sm[i + 1] - sm[i]) for i in range(len(sm) - 1)]
    mj = max(jumps)
    worst = max(worst, mj)
    # longest run of identical *raw* values (dither should break these up)
    run = best = 1
    for i in range(1, len(v)):
        run = run + 1 if round(v[i]) == round(v[i - 1]) else 1
        best = max(best, run)
    step = max(1, len(v) // 12)
    samples = " ".join(f"{round(x)}" for x in v[::step])
    print(f"{name}: range {min(v):.0f}-{max(v):.0f}, max smoothed jump {mj:.2f}, longest flat raw run {best}px\n    samples: {samples}")
print(f"RESULT: {'PASS' if worst < 1.5 else 'FAIL'} (worst smoothed jump {worst:.2f} code values)")
