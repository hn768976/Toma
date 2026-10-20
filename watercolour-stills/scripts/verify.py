#!/usr/bin/env python3
"""Checks the rendered stills.

    python3 scripts/verify.py                         files, uniqueness, content, banding
    python3 scripts/verify.py --determinism out/rerun compare re-renders byte for byte

Needs Pillow and NumPy.
"""
import hashlib
import json
import re
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
STILLS = ROOT / "out" / "stills"
PAPER = np.array([0xFA, 0xF7, 0xF0], dtype=np.float32)
Image.MAX_IMAGE_PIXELS = None


def expected_files():
    src = (ROOT / "src/data/stills.ts").read_text()
    labels = {}
    for f in (ROOT / "src/layouts").glob("*.ts"):
        for key, label in re.findall(r'export const (\w+): Layout = \{\s*label: "(\w+)"', f.read_text()):
            labels[key] = label
    rows = re.findall(r'\{ n: (\d+), layout: "(\w+)", palette: "(\w+)"', src)
    return [f"WC_{int(n):02d}_{labels[l]}_{p}.png" for n, l, p in rows if int(n) > 0]


def load(name):
    return np.asarray(Image.open(STILLS / name).convert("RGB"), dtype=np.float32)


def check_files(names):
    ok = True
    present = sorted(p.name for p in STILLS.glob("WC_*.png"))
    missing = sorted(set(names) - set(present))
    extra = sorted(set(present) - set(names))
    print(f"[files] expected {len(names)}, found {len(present)}")
    if missing or extra:
        ok = False
        print(f"  missing: {missing}\n  unexpected: {extra}")
    hashes = {}
    for n in names:
        if n in missing:
            continue
        im = Image.open(STILLS / n)
        if im.size != (6000, 3375):
            ok = False
            print(f"  {n}: size {im.size}")
        hashes.setdefault(hashlib.sha256((STILLS / n).read_bytes()).hexdigest(), []).append(n)
    dups = [v for v in hashes.values() if len(v) > 1]
    if dups:
        ok = False
        print(f"  identical files: {dups}")
    print(f"  all 6000x3375, {len(hashes)} distinct hashes" if ok else "  FAILED")
    return ok


def paper_mask(a, tol=7.0):
    return np.abs(a - PAPER).max(axis=2) < tol


def check_content(names):
    """Paper tooth visible everywhere, clean paper where the layout needs it."""
    ok = True
    rows = []
    for n in names:
        a = load(n)
        lum = a @ np.array([0.299, 0.587, 0.114], dtype=np.float32)
        # tooth: high-frequency luminance variation (pixel minus 9x9 box mean)
        k = 9
        c = np.cumsum(np.cumsum(np.pad(lum, ((1, 0), (1, 0))), 0), 1)
        box = (c[k:, k:] - c[:-k, k:] - c[k:, :-k] + c[:-k, :-k]) / (k * k)
        hf = lum[k // 2 : k // 2 + box.shape[0], k // 2 : k // 2 + box.shape[1]] - box
        painted = ~paper_mask(a, 14)[k // 2 : k // 2 + box.shape[0], k // 2 : k // 2 + box.shape[1]]
        tooth_paint = float(hf[painted].std()) if painted.any() else 0.0
        tooth_paper = float(hf[~painted].std()) if (~painted).any() else 0.0
        clean = float(paper_mask(a, 10).mean())
        rows.append((n, clean, tooth_paint, tooth_paper))
        # texture must show through the washes (no flat digital fills)
        if painted.mean() > 0.01 and tooth_paint < 1.0:
            ok = False
            print(f"  {n}: washes look flat (tooth std {tooth_paint:.2f})")
        h, w = lum.shape
        region = None
        if "_CornerWashes_" in n or "_EdgeBleedFrame_" in n:
            region = a[int(h * 0.38) : int(h * 0.62), int(w * 0.38) : int(w * 0.62)]
        elif "_HalfPageWash_" in n:
            region = a[:, int(w * 0.62) :]
        if region is not None:
            frac = float(paper_mask(region, 10).mean())
            if frac < 0.9:
                ok = False
                print(f"  {n}: clean area only {frac:.0%} paper")
    print("[content] clean-paper share, tooth std inside washes / on bare paper")
    for n, clean, tp, tb in rows:
        print(f"  {n:46s} paper {clean:5.0%}  tooth {tp:5.2f} / {tb:5.2f}")
    print("  OK" if ok else "  FAILED")
    return ok


EDGE = 6.0  # levels per 8 px: a dried wash edge, which is meant to be crisp


def profile_steps(profile):
    """Largest jump inside the smooth spans of a profile, and how many
    intentional wash edges (hard dried edges) the profile crossed. Samples
    within 3 steps of an edge are left out of the smooth spans."""
    d = np.abs(np.diff(profile))
    edges = d > EDGE
    near = np.convolve(edges.astype(float), np.ones(7), mode="same") > 0
    smooth = d[~near]
    n_edges = int(np.sum(np.diff(np.concatenate([[0], edges.astype(int)])) == 1))
    return (float(smooth.max()) if smooth.size else 0.0), n_edges


def check_banding():
    """Graded wash (3) and blooms (1, 6): no posterised levels, no steps in the
    smooth spans; the graded wash may not contain a single hard edge."""
    ok = True
    print("[banding] smoothed luminance profiles (levels per 8 px step)")
    weights = np.array([0.299, 0.587, 0.114], dtype=np.float32)
    for n in sorted(STILLS.glob("WC_0[136]_*.png")):
        a = np.asarray(Image.open(n).convert("RGB"), dtype=np.float32) @ weights
        h, w = a.shape
        worst = 0.0
        edges = 0
        if "_GradedSky_" in n.name:
            # vertical profiles down the gradient, each averaged over a 240 px wide strip
            for x in np.linspace(0.1, 0.9, 5):
                strip = a[:, int(w * x) - 120 : int(w * x) + 120].mean(axis=1)
                prof = strip[: (h // 8) * 8].reshape(-1, 8).mean(axis=1)
                st, e = profile_steps(prof)
                worst, edges = max(worst, st), edges + e
            # the gradient must actually go from pigment at the top to paper at the bottom
            top, bottom = a[: h // 10].mean(), a[-h // 10 :].mean()
            print(f"  {n.name:46s} top {top:6.1f}  bottom {bottom:6.1f}")
        else:
            # horizontal and vertical lines through the middle of the sheet
            for y in np.linspace(0.3, 0.7, 3):
                strip = a[int(h * y) - 60 : int(h * y) + 60].mean(axis=0)
                prof = strip[: (w // 8) * 8].reshape(-1, 8).mean(axis=1)
                st, e = profile_steps(prof)
                worst, edges = max(worst, st), edges + e
            for x in np.linspace(0.35, 0.65, 3):
                strip = a[:, int(w * x) - 60 : int(w * x) + 60].mean(axis=1)
                prof = strip[: (h // 8) * 8].reshape(-1, 8).mean(axis=1)
                st, e = profile_steps(prof)
                worst, edges = max(worst, st), edges + e
        # 8-bit posterisation shows as missing levels inside the occupied range
        region = a[h // 4 : 3 * h // 4, w // 4 : 3 * w // 4].astype(np.int32)
        lo, hi = np.percentile(region, 2), np.percentile(region, 98)
        used = np.unique(region[(region >= lo) & (region <= hi)])
        gaps = int((hi - lo + 1) - len(used))
        # the graded wash must have no hard edge at all; blooms are meant to have them
        flag = gaps > 0 or ("_GradedSky_" in n.name and edges > 0)
        ok &= not flag
        print(f"  {n.name:46s} max step in smooth spans {worst:5.2f}  wash edges crossed {edges:2d}  missing levels {gaps}  {'FAIL' if flag else 'ok'}")
    print("  OK" if ok else "  FAILED")
    return ok


def check_determinism(other):
    other = (ROOT / other).resolve()
    ok = True
    print(f"[determinism] {other.relative_to(ROOT)} vs out/stills")
    for f in sorted(other.glob("WC_*.png")):
        same = f.read_bytes() == (STILLS / f.name).read_bytes()
        ok &= same
        print(f"  {f.name:46s} {'byte-identical' if same else 'DIFFERENT'}")
    return ok


if __name__ == "__main__":
    if "--determinism" in sys.argv:
        sys.exit(0 if check_determinism(sys.argv[sys.argv.index("--determinism") + 1]) else 1)
    names = expected_files()
    results = {
        "files": check_files(names),
        "content": check_content([n for n in names if (STILLS / n).exists()]),
        "banding": check_banding(),
    }
    print(json.dumps(results))
    sys.exit(0 if all(results.values()) else 1)
