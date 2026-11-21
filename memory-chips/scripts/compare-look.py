#!/usr/bin/env python3
"""compare-look.py - compare measure-look.py numbers (reference vs attempt) and
optionally save a side-by-side image (reference | attempt | difference).

Usage:
  python3 scripts/compare-look.py ref.png mine.png [--out compare.png]
        [--mask x0,y0,x1,y1] [--near ...] [--far ...] [--skip hue,sat] [--md]

Targets: every value within +-10% of the reference (hue within +-10 degrees).
Values that are close to zero use a small absolute floor instead, because 10%
of nearly nothing is not a meaningful tolerance.
"""
import argparse
import importlib.util
import math
import os
import sys

import numpy as np
from PIL import Image, ImageDraw

_here = os.path.dirname(os.path.abspath(__file__))
_spec = importlib.util.spec_from_file_location("measure_look", os.path.join(_here, "measure-look.py"))
ml = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(ml)

# measure -> (kind, absolute floor)
RULES = {
    "lum_p1": ("rel", 0.015), "lum_p5": ("rel", 0.015), "lum_p50": ("rel", 0.015),
    "lum_p95": ("rel", 0.015), "lum_p99": ("rel", 0.015), "lum_mean": ("rel", 0.015),
    "pct_above_90": ("rel", 1.0), "pct_below_05": ("rel", 1.0),
    "sat_mean": ("rel", 0.02),
    "hue_shadows": ("hue", 10.0), "hue_midtones": ("hue", 10.0), "hue_highlights": ("hue", 10.0),
    "glow_r50_pct_w": ("rel", 1.0), "glow_r25_pct_w": ("rel", 1.5), "glow_r10_pct_w": ("rel", 2.0),
    "contrast_top": ("rel", 0.02), "contrast_mid": ("rel", 0.02), "contrast_bottom": ("rel", 0.02),
    "contrast_near": ("rel", 0.02), "contrast_far": ("rel", 0.02),
    "lum_near": ("rel", 0.015), "lum_far": ("rel", 0.015),
    "grain_std_255": ("rel", 0.15), "laplacian_var": ("rel", 1.0),
    "vignette_ratio": ("rel", 0.03),
}


def compare(ref, mine, skip=()):
    rows = []
    for k, (kind, floor) in RULES.items():
        if any(k.startswith(s) for s in skip):
            continue
        a, b = ref[k], mine[k]
        if isinstance(a, float) and math.isnan(a):
            continue
        if kind == "hue":
            d = (b - a + 180.0) % 360.0 - 180.0
            ok = abs(d) <= floor
            rows.append((k, a, b, f"{d:+.1f} deg", ok))
        else:
            d = b - a
            rel = d / a * 100.0 if abs(a) > 1e-9 else float("inf")
            ok = abs(d) <= max(abs(a) * 0.10, floor)
            rows.append((k, a, b, f"{rel:+.1f}%" if math.isfinite(rel) else f"{d:+.3f}", ok))
    return rows


def side_by_side(ref_path, mine_path, out_path, label=""):
    a = Image.open(ref_path).convert("RGB")
    b = Image.open(mine_path).convert("RGB").resize(a.size, Image.BOX)
    d = np.abs(np.asarray(a, np.int16) - np.asarray(b, np.int16)).astype(np.uint8)
    d = Image.fromarray(np.clip(d.astype(np.int16) * 2, 0, 255).astype(np.uint8))
    W, H = a.size
    pad = 22
    sheet = Image.new("RGB", (W * 3 + 8, H + pad), (24, 24, 24))
    for i, (im, name) in enumerate(((a, "reference"), (b, "attempt"), (d, "difference x2"))):
        sheet.paste(im, (i * (W + 4), pad))
        ImageDraw.Draw(sheet).text((i * (W + 4) + 6, 5), f"{name} {label}", fill=(230, 230, 230))
    sheet.save(out_path)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("ref")
    ap.add_argument("mine")
    ap.add_argument("--out")
    ap.add_argument("--label", default="")
    ap.add_argument("--mask", type=ml.parse_rect)
    ap.add_argument("--near", type=ml.parse_rect)
    ap.add_argument("--far", type=ml.parse_rect)
    ap.add_argument("--skip", default="")
    ap.add_argument("--md", action="store_true")
    a = ap.parse_args()
    r = ml.measure(a.ref, 898, a.mask, a.near, a.far)
    m = ml.measure(a.mine, 898, a.mask, a.near, a.far)
    rows = compare(r, m, tuple(s for s in a.skip.split(",") if s))
    if a.md:
        print("| measure | reference | attempt | diff | ok |\n|---|---|---|---|---|")
        for k, x, y, d, ok in rows:
            print(f"| {k} | {x:.3f} | {y:.3f} | {d} | {'yes' if ok else 'NO'} |")
    else:
        for k, x, y, d, ok in rows:
            print(f"{k:18s} ref {x:9.3f}  mine {y:9.3f}  {d:>10s}  {'ok' if ok else 'MISS'}")
    n_ok = sum(1 for r_ in rows if r_[4])
    print(f"-- {n_ok}/{len(rows)} within target")
    if a.out:
        side_by_side(a.ref, a.mine, a.out, a.label)
    return 0


if __name__ == "__main__":
    sys.exit(main())
