#!/usr/bin/env python3
"""look-table.py - step 8.7 look table for one final video.

Extracts 5 evenly spaced frames from the video, measures them and the same moments of
the reference with measure-look.py, and prints a Markdown table: per measure the
reference mean, the video mean, the difference of the means, and how many of the 5
frames are within target (+-10%, hue +-10 degrees, small absolute floors near zero).

usage: tools/look-table.py <video.mp4> <ref-frames-dir> <frames> <workdir>
           [--mask ..] [--near ..] [--far ..] [--skip prefix,prefix]
"""
import argparse
import importlib.util
import math
import os
import subprocess
import sys

here = os.path.dirname(os.path.abspath(__file__))
scripts = os.path.join(here, "..", "hazard-barrels", "scripts")


def load(name, file):
    spec = importlib.util.spec_from_file_location(name, os.path.join(scripts, file))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


ml = load("measure_look", "measure-look.py")
cl = load("compare_look", "compare-look.py")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("video")
    ap.add_argument("refdir")
    ap.add_argument("frames", type=int)
    ap.add_argument("workdir")
    ap.add_argument("--mask", type=ml.parse_rect)
    ap.add_argument("--near", type=ml.parse_rect)
    ap.add_argument("--far", type=ml.parse_rect)
    ap.add_argument("--skip", default="")
    a = ap.parse_args()
    os.makedirs(a.workdir, exist_ok=True)
    skip = tuple(s for s in a.skip.split(",") if s)
    idx = [k * (a.frames - 1) // 4 for k in range(5)]
    refs, mine = [], []
    for f in idx:
        out = os.path.join(a.workdir, f"frame-{f}.png")
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", a.video, "-vf", f"select=eq(n\\,{f})", "-frames:v", "1", out], check=True)
        refs.append(ml.measure(os.path.join(a.refdir, f"{f + 1:04d}.png"), 898, a.mask, a.near, a.far))
        mine.append(ml.measure(out, 898, a.mask, a.near, a.far))
    print(f"Frames measured: {', '.join(str(i) for i in idx)} (reference frames {', '.join(str(i + 1) for i in idx)})\n")
    print("| measure | reference (mean) | video (mean) | difference | frames within target |")
    print("|---|---|---|---|---|")
    total_ok = total = 0
    for k, (kind, floor) in cl.RULES.items():
        if any(k.startswith(s) for s in skip):
            print(f"| {k} | – | – | skipped (changed on purpose in Version 2) | – |")
            continue
        rv = [r[k] for r in refs]
        mv = [m[k] for m in mine]
        ok = 0
        for r, m in zip(rv, mv):
            if kind == "hue":
                d = (m - r + 180) % 360 - 180
                ok += abs(d) <= floor
            else:
                ok += abs(m - r) <= max(abs(r) * 0.10, floor)
        if kind == "hue":
            # circular means
            rm = math.degrees(math.atan2(sum(math.sin(math.radians(v)) for v in rv), sum(math.cos(math.radians(v)) for v in rv))) % 360
            mm = math.degrees(math.atan2(sum(math.sin(math.radians(v)) for v in mv), sum(math.cos(math.radians(v)) for v in mv))) % 360
            d = (mm - rm + 180) % 360 - 180
            diff = f"{d:+.1f}°"
        else:
            rm = sum(rv) / 5
            mm = sum(mv) / 5
            diff = f"{(mm - rm) / rm * 100:+.1f}%" if abs(rm) > 1e-9 else f"{mm - rm:+.3f}"
        total_ok += ok
        total += 5
        print(f"| {k} | {rm:.3f} | {mm:.3f} | {diff} | {ok}/5 |")
    print(f"\n**{total_ok}/{total} frame-measures within target.**")
    return 0


if __name__ == "__main__":
    sys.exit(main())
