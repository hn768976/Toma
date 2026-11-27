#!/usr/bin/env python3
"""measure-look.py - measure the light, atmosphere and texture of a frame.

Usage
  measure-look.py FRAME.png [--json out.json]
  measure-look.py REF.png MINE.png [--json out.json] [--skip hue,sat]
  measure-look.py REF.png MINE.png --side-by-side compare.png

Every frame is first resized to a common working size (default 768x432, the
size of the reference clips) so numbers from a 432p reference and a 1080p/4K
render are comparable. --mask x0,y0,x1,y1 (in working-size pixels) excludes a
rectangle (used for the stock-agency watermark in the reference) from all stats.

Dependencies: numpy + Pillow only.
"""
import argparse
import json
import math
import sys

import numpy as np
from PIL import Image

WORK = (768, 432)


# ----------------------------------------------------------------- helpers
def load(path, size=WORK):
    im = Image.open(path).convert("RGB")
    if im.size != size:
        im = im.resize(size, Image.LANCZOS)
    return np.asarray(im).astype(np.float64) / 255.0


def luma(rgb):
    return 0.2126 * rgb[..., 0] + 0.7152 * rgb[..., 1] + 0.0722 * rgb[..., 2]


def gauss_kernel(sigma):
    r = max(1, int(math.ceil(sigma * 3)))
    x = np.arange(-r, r + 1)
    k = np.exp(-(x * x) / (2 * sigma * sigma))
    return k / k.sum()


def blur(a, sigma):
    """Separable gaussian blur with edge replication (2D array)."""
    k = gauss_kernel(sigma)
    r = len(k) // 2
    out = a
    for axis in (0, 1):
        pad = [(0, 0), (0, 0)]
        pad[axis] = (r, r)
        p = np.pad(out, pad, mode="edge")
        acc = np.zeros_like(out)
        n = out.shape[axis]
        for i, w in enumerate(k):
            sl = [slice(None), slice(None)]
            sl[axis] = slice(i, i + n)
            acc += w * p[tuple(sl)]
        out = acc
    return out


def hue_sat(rgb):
    mx = rgb.max(-1)
    mn = rgb.min(-1)
    c = mx - mn
    sat = np.where(mx > 1e-6, c / np.maximum(mx, 1e-6), 0.0)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    h = np.zeros_like(mx)
    cc = np.maximum(c, 1e-9)
    h = np.where(mx == r, ((g - b) / cc) % 6, h)
    h = np.where(mx == g, ((b - r) / cc) + 2, h)
    h = np.where(mx == b, ((r - g) / cc) + 4, h)
    return (h * 60.0) % 360.0, sat, c


def circ_mean_hue(h, w):
    if w.sum() < 1e-9:
        return float("nan")
    a = np.deg2rad(h)
    s = (np.sin(a) * w).sum()
    c = (np.cos(a) * w).sum()
    return float(np.rad2deg(math.atan2(s, c)) % 360.0)


def pct(a, q):
    return float(np.percentile(a, q))


# ----------------------------------------------------------------- measures
def measure(rgb, mask=None):
    H, W = rgb.shape[:2]
    Y = luma(rgb)
    valid = np.ones((H, W), bool)
    if mask:
        x0, y0, x1, y1 = mask
        valid[y0:y1, x0:x1] = False
    yv = Y[valid]
    m = {}

    # 1. luminance percentiles (0-100)
    for q in (1, 5, 50, 95, 99):
        m[f"lum_p{q}"] = pct(yv, q) * 100
    m["lum_mean"] = float(yv.mean() * 100)

    # 2. glow / dark area
    m["pct_above_90"] = float((yv > 0.90).mean() * 100)
    m["pct_below_5"] = float((yv < 0.05).mean() * 100)

    # 3. saturation and split-tone hues. Bands are luminance terciles of the
    #    frame itself, hue is a chroma-weighted circular mean.
    hue, sat, chroma = hue_sat(rgb)
    m["sat_mean"] = float(sat[valid].mean() * 100)
    m["chroma_mean"] = float(chroma[valid].mean() * 100)
    t1, t2 = np.percentile(yv, [33.3, 66.6])
    bands = {
        "shadows": valid & (Y <= t1),
        "midtones": valid & (Y > t1) & (Y <= t2),
        "highlights": valid & (Y > t2),
    }
    for name, sel in bands.items():
        m[f"hue_{name}"] = circ_mean_hue(hue[sel], chroma[sel])

    # 4. glow falloff: radial brightness profile outward from the brightest
    #    element (brightest spot of a lightly blurred frame). Distances are in
    #    % of frame width, levels are relative to (peak - p5 background).
    Yb = blur(Y, 3.0)
    Ybm = np.where(valid, Yb, -1)
    py, px = np.unravel_index(np.argmax(Ybm), Ybm.shape)
    yy, xx = np.mgrid[0:H, 0:W]
    dist = np.hypot(xx - px, yy - py)
    maxr = int(dist.max())
    idx = dist.astype(int)
    w = valid.astype(float)
    sums = np.bincount(idx.ravel(), (Yb * w).ravel(), minlength=maxr + 1)
    cnts = np.bincount(idx.ravel(), w.ravel(), minlength=maxr + 1)
    prof = sums / np.maximum(cnts, 1)
    base = pct(yv, 5)
    peak = prof[0]
    rel = (prof - base) / max(peak - base, 1e-6)
    m["glow_peak"] = float(peak * 100)
    m["glow_peak_x"] = float(px / W * 100)
    m["glow_peak_y"] = float(py / H * 100)
    for lvl in (50, 25, 10):
        below = np.where(rel <= lvl / 100.0)[0]
        m[f"glow_r{lvl}"] = float(below[0] / W * 100) if len(below) else float(maxr / W * 100)

    # 5. haze: contrast (p95 - p5) per horizontal third, and far (top) vs
    #    near (bottom) ratio; also the black level (p5) of each third.
    thirds = [("top", 0, H // 3), ("mid", H // 3, 2 * H // 3), ("bot", 2 * H // 3, H)]
    for name, a, b in thirds:
        sel = valid[a:b]
        v = Y[a:b][sel]
        m[f"contrast_{name}"] = (pct(v, 95) - pct(v, 5)) * 100
        m[f"black_{name}"] = pct(v, 5) * 100
        m[f"mean_{name}"] = float(v.mean() * 100)
    m["haze_far_near_contrast"] = m["contrast_top"] / max(m["contrast_bot"], 1e-6)

    # 6. grain: std-dev of the high-passed flattest 48x48 block (x1000).
    hp = Y - blur(Y, 1.5)
    grad = blur(np.abs(Y - blur(Y, 4.0)), 6.0)
    best = None
    B = 48
    for by in range(0, H - B + 1, 12):
        for bx in range(0, W - B + 1, 12):
            if not valid[by:by + B, bx:bx + B].all():
                continue
            g = grad[by:by + B, bx:bx + B].mean()
            if best is None or g < best[0]:
                best = (g, by, bx)
    _, by, bx = best
    m["grain_flat_std"] = float(hp[by:by + B, bx:bx + B].std() * 1000)
    m["grain_global_std"] = float(hp[valid].std() * 1000)

    # 7. detail: Laplacian variance (x1e4) and fine/medium/coarse band energy.
    lap = np.zeros_like(Y)
    lap[1:-1, 1:-1] = (Y[:-2, 1:-1] + Y[2:, 1:-1] + Y[1:-1, :-2] + Y[1:-1, 2:] - 4 * Y[1:-1, 1:-1])
    inner = valid.copy()
    inner[0, :] = inner[-1, :] = False
    inner[:, 0] = inner[:, -1] = False
    m["detail_laplacian_var"] = float(lap[inner].var() * 1e4)
    b1, b2, b3 = blur(Y, 1.0), blur(Y, 4.0), blur(Y, 16.0)
    m["detail_fine"] = float((Y - b1)[valid].std() * 1000)
    m["detail_medium"] = float((b1 - b2)[valid].std() * 1000)
    m["detail_coarse"] = float((b2 - b3)[valid].std() * 1000)

    # 8. vignette: mean of the four corner blocks / mean of the centre block.
    cw, ch = W // 8, H // 8
    corners = [Y[:ch, :cw], Y[:ch, -cw:], Y[-ch:, :cw], Y[-ch:, -cw:]]
    corner = float(np.mean([c.mean() for c in corners]))
    cy0, cy1, cx0, cx1 = H // 2 - H // 6, H // 2 + H // 6, W // 2 - W // 6, W // 2 + W // 6
    centre = float(Y[cy0:cy1, cx0:cx1][valid[cy0:cy1, cx0:cx1]].mean())
    m["vignette_corner_centre"] = corner / max(centre, 1e-6)
    return m


# ------------------------------------------------------------- comparison
# Relative tolerance is 10 %. Measures that sit near zero get an absolute
# floor (same units as the measure) so 0.02 vs 0.03 does not read as "50 % off".
ABS_FLOOR = {
    "lum_p1": 1.0, "lum_p5": 1.0, "lum_p50": 1.5, "lum_p95": 2.0, "lum_p99": 2.0, "lum_mean": 1.5,
    "pct_above_90": 1.0, "pct_below_5": 2.5,
    "sat_mean": 3.0, "chroma_mean": 1.5,
    "glow_peak": 3.0, "glow_r50": 1.5, "glow_r25": 2.5, "glow_r10": 4.0,
    "contrast_top": 2.0, "contrast_mid": 2.0, "contrast_bot": 2.0,
    "black_top": 1.5, "black_mid": 1.0, "black_bot": 1.0,
    "mean_top": 2.0, "mean_mid": 1.5, "mean_bot": 1.5,
    "haze_far_near_contrast": 0.1,
    "grain_flat_std": 1.0, "grain_global_std": 1.5,
    "detail_laplacian_var": 0.5, "detail_fine": 1.5, "detail_medium": 1.5, "detail_coarse": 1.5,
    "vignette_corner_centre": 0.06,
}
INFO_ONLY = {"glow_peak_x", "glow_peak_y"}
GROUPS = {
    "hue": ["hue_shadows", "hue_midtones", "hue_highlights"],
    "sat": ["sat_mean", "chroma_mean"],
    "glow": ["glow_peak", "glow_r50", "glow_r25", "glow_r10"],
    "vignette": ["vignette_corner_centre"],
    "haze": ["contrast_top", "contrast_mid", "contrast_bot", "black_top", "black_mid", "black_bot",
             "mean_top", "mean_mid", "mean_bot", "haze_far_near_contrast"],
}


def compare(ref, mine, skip=()):
    skipped = set()
    for s in skip:
        skipped.update(GROUPS.get(s, [s]))
    rows = []
    for k in ref:
        a, b = ref[k], mine[k]
        if k in INFO_ONLY or k in skipped:
            rows.append((k, a, b, None, "n/a", "skip" if k in skipped else "info"))
            continue
        if k.startswith("hue_"):
            if math.isnan(a) or math.isnan(b):
                rows.append((k, a, b, None, "n/a", "info"))
                continue
            d = (b - a + 180) % 360 - 180
            rows.append((k, a, b, d, f"{d:+.1f} deg", "PASS" if abs(d) <= 10 else "FAIL"))
            continue
        d = b - a
        rel = d / a * 100 if abs(a) > 1e-9 else float("inf") if abs(d) > 1e-9 else 0.0
        ok = abs(rel) <= 10 or abs(d) <= ABS_FLOOR.get(k, 0)
        rows.append((k, a, b, d, f"{rel:+.1f}%", "PASS" if ok else "FAIL"))
    return rows


def side_by_side(ref, mine, out, gain=3.0):
    a = (ref * 255).astype(np.uint8)
    b = (mine * 255).astype(np.uint8)
    d = np.clip(np.abs(ref - mine) * gain * 255, 0, 255).astype(np.uint8)
    gap = np.full((a.shape[0], 6, 3), 40, np.uint8)
    Image.fromarray(np.concatenate([a, gap, b, gap, d], axis=1)).save(out)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("frames", nargs="+")
    ap.add_argument("--json")
    ap.add_argument("--mask", help="x0,y0,x1,y1 at working size, excluded from stats")
    ap.add_argument("--size", default="768x432")
    ap.add_argument("--skip", default="", help="comma list of measures or groups (hue,sat,glow,vignette,haze)")
    ap.add_argument("--side-by-side")
    ap.add_argument("--quiet", action="store_true")
    a = ap.parse_args()
    size = tuple(int(v) for v in a.size.split("x"))
    mask = tuple(int(v) for v in a.mask.split(",")) if a.mask else None
    imgs = [load(p, size) for p in a.frames]
    res = [measure(i, mask) for i in imgs]
    out = {"frames": a.frames, "measures": res}
    if len(res) == 1:
        if not a.quiet:
            for k, v in res[0].items():
                print(f"{k:26s} {v:9.3f}")
    else:
        rows = compare(res[0], res[1], [s for s in a.skip.split(",") if s])
        out["compare"] = [dict(measure=r[0], ref=r[1], mine=r[2], diff=r[3], rel=r[4], status=r[5]) for r in rows]
        fails = [r for r in rows if r[5] == "FAIL"]
        if not a.quiet:
            print(f"{'measure':26s} {'ref':>9s} {'mine':>9s} {'diff':>10s}  status")
            for k, x, y, d, rel, st in rows:
                print(f"{k:26s} {x:9.3f} {y:9.3f} {rel:>10s}  {st}")
        print(f"-- {len(rows) - len(fails)} ok/info, {len(fails)} FAIL: {', '.join(r[0] for r in fails)}")
        if a.side_by_side:
            side_by_side(imgs[0], imgs[1], a.side_by_side)
    if a.json:
        with open(a.json, "w") as f:
            json.dump(out, f, indent=1)
    return 0


if __name__ == "__main__":
    sys.exit(main())
