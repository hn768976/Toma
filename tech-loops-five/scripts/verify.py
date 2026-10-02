#!/usr/bin/env python3
"""
Verification for the Tech Loops previews (needs ffmpeg/ffprobe, numpy, pillow).

  python3 scripts/verify.py probe              Step 1: file checks on out/previews/*.mp4
  python3 scripts/verify.py loop               Step 2: out/loopcheck/<file>_0.png vs _600.png
  python3 scripts/verify.py determinism        Step 3: out/cold/<file>_300.png vs out/frames/<file>/frame-0300.png
  python3 scripts/verify.py banding            Step 4: profiles across glow falloffs, read from the encoded mp4
  python3 scripts/verify.py sheets             Step 5: five evenly spaced frames per preview → out/sheets/
"""
import json
import os
import subprocess
import sys

import numpy as np
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
OUT = os.path.join(ROOT, "out")
FILES = [
    "BinaryWord_BinaryCode", "BinaryWord_DataStream",
    "SoftSpinner_Amber", "SoftSpinner_IceBlue",
    "SecurityDashboard_Teal", "SecurityDashboard_IceViolet",
    "ModelTraining_LLM", "ModelTraining_FineTuning",
    "AICoreTunnel_Cyan", "AICoreTunnel_Violet",
]
LOOPING = [f for f in FILES if not f.startswith("ModelTraining")]


def load(p):
    return np.asarray(Image.open(p).convert("RGB")).astype(np.int16)


def probe():
    ok_all = True
    for f in FILES:
        p = os.path.join(OUT, "previews", f + ".mp4")
        if not os.path.exists(p):
            print(f"{f}: MISSING")
            ok_all = False
            continue
        r = json.loads(subprocess.check_output([
            "ffprobe", "-v", "error", "-show_entries",
            "stream=codec_type,codec_name,width,height,r_frame_rate,pix_fmt,nb_frames",
            "-show_entries", "format=duration", "-of", "json", p]))
        streams = r["streams"]
        v = [s for s in streams if s["codec_type"] == "video"]
        a = [s for s in streams if s["codec_type"] == "audio"]
        s = v[0]
        dur = float(r["format"]["duration"])
        ok = (s["codec_name"] == "h264" and s["width"] == 1920 and s["height"] == 1080
              and s["r_frame_rate"] == "30/1" and s["pix_fmt"] == "yuv420p"
              and abs(dur - 20.0) < 0.001 and not a and len(v) == 1)
        ok_all &= ok
        size = os.path.getsize(p) / 1e6
        print(f"{'PASS' if ok else 'FAIL'} {f}: {s['codec_name']} {s['width']}x{s['height']} "
              f"{s['r_frame_rate']} {s['pix_fmt']} {dur:.3f}s frames={s.get('nb_frames')} "
              f"audio_streams={len(a)} size={size:.1f}MB")
    return ok_all


def loop():
    ok_all = True
    for f in LOOPING:
        a = os.path.join(OUT, "loopcheck", f + "_0.png")
        b = os.path.join(OUT, "loopcheck", f + "_600.png")
        if not (os.path.exists(a) and os.path.exists(b)):
            print(f"{f}: MISSING")
            ok_all = False
            continue
        A, B = load(a), load(b)
        diff = np.abs(A - B)
        n = int((diff.max(axis=2) > 0).sum())
        same_bytes = open(a, "rb").read() == open(b, "rb").read()
        ok = n == 0
        ok_all &= ok
        print(f"{'PASS' if ok else 'FAIL'} {f}: frame 0 vs 600 differing pixels={n} max diff={int(diff.max())} identical_png_bytes={same_bytes}")
    return ok_all


def determinism():
    ok_all = True
    for f in FILES:
        a = os.path.join(OUT, "cold", f + "_300.png")
        b = os.path.join(OUT, "frames", f, "frame-0300.png")
        if not (os.path.exists(a) and os.path.exists(b)):
            print(f"{f}: MISSING ({'cold' if not os.path.exists(a) else 'full-render frame'})")
            ok_all = False
            continue
        same_bytes = open(a, "rb").read() == open(b, "rb").read()
        A, B = load(a), load(b)
        n = int((np.abs(A - B).max(axis=2) > 0).sum())
        ok = same_bytes
        ok_all &= ok
        print(f"{'PASS' if ok else 'FAIL'} {f}: cold frame 300 vs full-render frame 300: identical bytes={same_bytes} differing pixels={n}")
    return ok_all


def extract(f, frame, dst):
    p = os.path.join(OUT, "previews", f + ".mp4")
    subprocess.check_call(["ffmpeg", "-v", "error", "-y", "-i", p, "-vf", f"select=eq(n\\,{frame})",
                           "-frames:v", "1", dst])
    return load(dst)


def banding():
    """
    Reads frame 300 FROM THE ENCODED MP4 and samples luminance across a glow
    falloff:
      - spinner: a horizontal ray from a petal tip out into the dark
        (9-row average, then an 8-px box filter),
      - tunnel: radial MEDIAN profile around the emblem centre (the median over
        720 angles removes the crossing streaks), 1-px radius steps.
    Banding shows as a staircase: flat plateaus separated by jumps. PASS needs
    no plateau in the smoothed profile (a flat 10-px segment between two falling
    ones) and no run of >= 24 identical raw 8-bit values along the ray.
    """
    os.makedirs(os.path.join(OUT, "banding"), exist_ok=True)
    report = {}
    ok_all = True
    for f in ["SoftSpinner_Amber", "SoftSpinner_IceBlue", "AICoreTunnel_Cyan", "AICoreTunnel_Violet"]:
        img = extract(f, 300, os.path.join(OUT, "banding", f"{f}_300.png")).astype(float)
        lum = 0.2126 * img[..., 0] + 0.7152 * img[..., 1] + 0.0722 * img[..., 2]
        if f.startswith("SoftSpinner"):
            y, x0, x1 = 540, 1230, 1800
            raw = lum[y, x0:x1]
            prof = np.convolve(lum[y - 4:y + 5, x0:x1].mean(axis=0), np.ones(8) / 8, mode="valid")
            where = f"ray y={y}, x={x0}..{x1}"
        else:
            cx, cy = 960, 540
            ang = np.linspace(0, 2 * np.pi, 720, endpoint=False)
            radii = np.arange(120, 520)
            prof = np.array([np.median(lum[(cy + r * np.sin(ang)).astype(int), (cx + r * np.cos(ang)).astype(int)]) for r in radii])
            prof = np.convolve(prof, np.ones(8) / 8, mode="valid")
            # raw run-lengths along the darkest of 8 rays
            rays = []
            for k in range(8):
                a = k * np.pi / 4 + 0.2
                rays.append(lum[(cy + radii * np.sin(a)).astype(int), (cx + radii * np.cos(a)).astype(int)])
            raw = min(rays, key=lambda r: r.mean())
            where = f"radial median r=120..520 around ({cx},{cy})"
        steps = np.abs(np.diff(prof))
        # raw run-lengths only where there is a gradient to band (profile > background + 1);
        # x264 may flatten small patches of perfectly flat background, which is harmless
        bg0 = float(np.median(prof[-60:]))
        grad_end = int(np.argmax(prof < bg0 + 1)) or len(prof)
        r = np.round(raw[: grad_end + 7]).astype(int)
        run = best = 1
        for i in range(1, len(r)):
            run = run + 1 if r[i] == r[i - 1] else 1
            best = max(best, run)
        coarse = [round(float(v), 1) for v in prof[::25]]
        # plateau = a 10-px segment that is flat while both neighbours fall
        # only the falloff itself: from the bright end down to background + 2
        bg = float(np.median(prof[-60:]))
        end = int(np.argmax(prof < bg + 2)) or len(prof)
        fall = prof[:end]
        p10 = fall[::4] if len(fall) < 120 else fall[::10]
        d = np.diff(p10)
        plateaus = int(sum(1 for i in range(1, len(d) - 1) if abs(d[i]) < 0.15 and abs(d[i - 1]) > 0.6 and abs(d[i + 1]) > 0.6))
        ok = plateaus == 0 and best < 24
        ok_all &= ok
        print(f"    falloff ({len(fall)} px, bg {bg:.1f}): {[round(float(v), 1) for v in fall[::max(1, len(fall) // 20)]]}")
        report[f] = {"where": where, "plateaus": plateaus, "falloff_px": len(fall), "background": round(bg, 1), "max_step_smoothed": round(float(steps.max()), 2), "longest_flat_run_raw_px": int(best), "profile_every_25px": coarse}
        print(f"{'PASS' if ok else 'FAIL'} {f}: {where}: plateaus {plateaus}, longest flat raw run {best}px, max neighbour step {steps.max():.2f}")
        print(f"    profile (every 25 px): {coarse}")
    with open(os.path.join(OUT, "banding", "banding_report.json"), "w") as fh:
        json.dump(report, fh, indent=2)
    return ok_all


def sheets():
    """Five evenly spaced frames per preview (decoded from the mp4) → out/sheets/<file>.png"""
    os.makedirs(os.path.join(OUT, "sheets"), exist_ok=True)
    for f in FILES:
        frames = [0, 120, 240, 360, 480] if f in LOOPING else [60, 180, 300, 420, 599]
        sel = "+".join(f"eq(n\\,{n})" for n in frames)
        tmp = os.path.join(OUT, "sheets", f"_{f}_%d.png")
        subprocess.check_call(["ffmpeg", "-v", "error", "-y", "-i", os.path.join(OUT, "previews", f + ".mp4"),
                               "-vf", f"select='{sel}',scale=640:360", "-vsync", "0", tmp])
        sheet = Image.new("RGB", (1920, 720), (20, 20, 20))
        for i in range(5):
            p = tmp.replace("%d", str(i + 1))
            sheet.paste(Image.open(p), ((i % 3) * 640, (i // 3) * 360))
            os.remove(p)
        sheet.save(os.path.join(OUT, "sheets", f + ".png"))
        print("sheet", f, frames)


if __name__ == "__main__":
    mode = sys.argv[1] if len(sys.argv) > 1 else "probe"
    res = {"probe": probe, "loop": loop, "determinism": determinism, "banding": banding, "sheets": sheets}[mode]()
    if res is False:
        sys.exit(1)
