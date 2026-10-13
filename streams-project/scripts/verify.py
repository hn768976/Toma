#!/usr/bin/env python3
"""Verification for the 720p previews (run after scripts/render-previews.sh).

  python3 scripts/verify.py probe        # step 1: ffprobe checks
  python3 scripts/verify.py loop         # step 2: frame 0 vs 600 on a 601-frame comp
  python3 scripts/verify.py determinism  # step 3: cold-start still vs full-render frame
  python3 scripts/verify.py banding      # step 4: pixel ramps read from the encoded mp4
  python3 scripts/verify.py sheets       # step 5: 5-frame contact sheets
An optional list of id prefixes restricts the check, e.g. `verify.py probe Light`.
Needs ffmpeg/ffprobe and Pillow.
"""
import json, os, subprocess, sys
from PIL import Image, ImageChops

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
SCALE = "0.3333333333333333"
COMPS = {
    "LightStreams-CoralViolet": 600, "LightStreams-TealBlue": 600,
    "ShieldDome-Story": 300, "ShieldDome-HoldLoop": 600,
    "NeonWaves-PinkBlue": 600, "PillSpill-Blue": 600,
    "PillSpill-WhiteOrange": 600, "DataStrands-BlueOrange": 600,
}
OUT = "out/verify"
os.makedirs(OUT, exist_ok=True)

def mp4(c): return f"out/previews/{c.replace('-', '_', 1)}.mp4"
def run(*a): return subprocess.run(a, capture_output=True, text=True)

def still(c, frame, path, props=None):
    args = ["npx", "remotion", "still", "out/bundle", c, path, f"--frame={frame}", f"--scale={SCALE}", "--log=error"]
    if props: args.append(f"--props={json.dumps(props)}")
    r = run(*args)
    if r.returncode: print(r.stdout, r.stderr)

def probe():
    ok = True
    for c, n in COMPS.items():
        r = run("ffprobe", "-v", "error", "-show_entries", "stream=codec_type,codec_name,width,height,r_frame_rate,pix_fmt",
                "-show_entries", "format=duration", "-of", "json", mp4(c))
        j = json.loads(r.stdout)
        s = j["streams"]
        v = s[0]
        dur = float(j["format"]["duration"])
        good = (len(s) == 1 and v["codec_type"] == "video" and v["codec_name"] == "h264" and v["width"] == 1280
                and v["height"] == 720 and v["r_frame_rate"] == "30/1" and v["pix_fmt"] == "yuv420p"
                and abs(dur - n / 30) < 0.001)
        ok &= good
        print(f"{'PASS' if good else 'FAIL'} {c}: {v['codec_name']} {v['width']}x{v['height']} {v['r_frame_rate']} {v['pix_fmt']} streams={len(s)} dur={dur}")
    return ok

def same(a, b):
    ia, ib = Image.open(a).convert("RGB"), Image.open(b).convert("RGB")
    return ImageChops.difference(ia, ib).getbbox() is None, open(a, "rb").read() == open(b, "rb").read()

def loop():
    for c, n in COMPS.items():
        if n != 600: continue
        a, b = f"{OUT}/{c}_loop0.png", f"{OUT}/{c}_loop600.png"
        still(c, 0, a, {"loopCheck": True}); still(c, 600, b, {"loopCheck": True})
        px, by = same(a, b)
        print(f"{'PASS' if px else 'FAIL'} loop {c}: pixels identical={px} bytes identical={by}")

def determinism():
    for c, n in COMPS.items():
        f = 150 if n == 300 else 300
        cold = f"{OUT}/{c}_cold{f}.png"
        still(c, f, cold)
        full = f"out/frames/{c}/element-{f:03d}.png"
        px, by = same(cold, full)
        print(f"{'PASS' if by else 'FAIL'} determinism {c} frame {f}: bytes identical={by} pixels identical={px}")

# (x, y0, y1) vertical probes on 1280x720 frames, through the areas that band
PROBES = {
    "LightStreams-CoralViolet": [(1100, 0, 300), (300, 0, 150)],
    "LightStreams-TealBlue": [(1100, 0, 300)],
    "ShieldDome-Story": [(150, 0, 330)],
    "ShieldDome-HoldLoop": [(150, 0, 330)],
    "NeonWaves-PinkBlue": [(640, 0, 719)],
    "PillSpill-Blue": [(150, 0, 200)],
    "PillSpill-WhiteOrange": [(150, 0, 200)],
    "DataStrands-BlueOrange": [(30, 0, 719)],
}

def banding():
    for c, n in COMPS.items():
        f = 150 if n == 300 else 300
        png = f"{OUT}/{c}_mp4_{f}.png"
        run("ffmpeg", "-v", "error", "-y", "-i", mp4(c), "-vf", f"select=eq(n\\,{f})", "-frames:v", "1", png)
        im = Image.open(png).convert("RGB")
        for x, y0, y1 in PROBES[c]:
            # average a 9 px wide column, 8-row bins, and report the largest
            # step between neighbouring bins (a band would show as a jump)
            rows = []
            for y in range(y0, y1 + 1):
                px = [im.getpixel((xx, y)) for xx in range(x - 4, x + 5)]
                rows.append(sum(sum(p) / 3 for p in px) / len(px))
            bins = [sum(rows[i:i + 8]) / len(rows[i:i + 8]) for i in range(0, len(rows), 8)]
            steps = [abs(bins[i + 1] - bins[i]) for i in range(len(bins) - 1)]
            lo, hi = min(rows), max(rows)
            print(f"{c} x={x} y={y0}-{y1}: luma {lo:.1f}..{hi:.1f}, max step between 8px bins {max(steps):.2f}, bins {[round(b, 1) for b in bins[:12]]}...")

def sheets():
    for c, n in COMPS.items():
        frames = [int(i * (n - 1) / 4) for i in range(5)]
        tiles = [Image.open(f"out/frames/{c}/element-{f:03d}.png").convert("RGB").resize((384, 216), Image.LANCZOS) for f in frames]
        sheet = Image.new("RGB", (384 * 5, 216))
        for i, t in enumerate(tiles): sheet.paste(t, (384 * i, 0))
        sheet.save(f"{OUT}/{c}_sheet.png")
        print("wrote", f"{OUT}/{c}_sheet.png", frames)

if __name__ == "__main__":
    # optional: restrict to compositions whose id starts with any given prefix
    if len(sys.argv) > 2:
        COMPS = {k: v for k, v in COMPS.items() if k.startswith(tuple(sys.argv[2:]))}
    {"probe": probe, "loop": loop, "determinism": determinism, "banding": banding, "sheets": sheets}[sys.argv[1]]()
