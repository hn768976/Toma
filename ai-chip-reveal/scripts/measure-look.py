#!/usr/bin/env python3
"""measure-look.py - measure the light, atmosphere and texture of a frame.

Usage:
    python3 scripts/measure-look.py frame.png [more.png ...] [--json out.json]
                                    [--size 768x432] [--mask x0,y0,x1,y1]

Every frame is first resampled to a common working size (default 768x432,
area/Lanczos) so that a 432p reference and a 1080p/4K render are measured
on equal terms.  All brightness values are display-referred (sRGB-encoded,
Rec.709 luma) in the range 0..1 unless stated otherwise.

--mask excludes a rectangle (fractions of width/height) from the statistics;
it is used to keep a stock-agency watermark out of the numbers.  The glow
measurement ignores the mask (the brightest element may sit under it).

Only numpy + Pillow are required.
"""
import argparse
import json
import sys

import numpy as np
from PIL import Image


# ----------------------------------------------------------------- helpers
def load(path, size):
    im = Image.open(path).convert("RGB")
    if im.size != size:
        im = im.resize(size, Image.LANCZOS)
    return np.asarray(im, dtype=np.float64) / 255.0


def luma(rgb):
    return rgb[..., 0] * 0.2126 + rgb[..., 1] * 0.7152 + rgb[..., 2] * 0.0722


def gauss_kernel(sigma):
    r = max(1, int(round(sigma * 3)))
    x = np.arange(-r, r + 1, dtype=np.float64)
    k = np.exp(-(x * x) / (2 * sigma * sigma))
    return k / k.sum()


def blur(img, sigma):
    """Separable gaussian blur with reflected edges (2-D array)."""
    k = gauss_kernel(sigma)
    r = len(k) // 2
    p = np.pad(img, ((0, 0), (r, r)), mode="reflect")
    out = np.zeros_like(img)
    for i, w in enumerate(k):
        out += w * p[:, i:i + img.shape[1]]
    p = np.pad(out, ((r, r), (0, 0)), mode="reflect")
    out2 = np.zeros_like(img)
    for i, w in enumerate(k):
        out2 += w * p[i:i + img.shape[0], :]
    return out2


def rgb_to_hsv(rgb):
    mx = rgb.max(-1)
    mn = rgb.min(-1)
    d = mx - mn
    s = np.where(mx > 1e-6, d / np.maximum(mx, 1e-6), 0.0)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    h = np.zeros_like(mx)
    dd = np.maximum(d, 1e-9)
    h = np.where(mx == r, ((g - b) / dd) % 6, h)
    h = np.where(mx == g, ((b - r) / dd) + 2, h)
    h = np.where(mx == b, ((r - g) / dd) + 4, h)
    h = np.where(d < 1e-6, 0.0, h) * 60.0
    return h, s, mx


def circ_mean_hue(h, w):
    """Weighted circular mean of hue (degrees). Returns (hue, strength 0..1)."""
    if w.sum() < 1e-9:
        return None, 0.0
    a = np.deg2rad(h)
    x = (np.cos(a) * w).sum() / w.sum()
    y = (np.sin(a) * w).sum() / w.sum()
    return float(np.rad2deg(np.arctan2(y, x)) % 360.0), float(np.hypot(x, y))


# ---------------------------------------------------------------- measures
def measure(path, size=(768, 432), mask=None):
    rgb = load(path, size)
    H, W = rgb.shape[:2]
    L = luma(rgb)

    keep = np.ones((H, W), dtype=bool)
    if mask:
        x0, y0, x1, y1 = mask
        keep[int(y0 * H):int(y1 * H), int(x0 * W):int(x1 * W)] = False

    out = {"file": path, "size": [W, H]}

    # --- luminance percentiles ------------------------------------------
    Lk = L[keep]
    for p in (1, 5, 50, 95, 99):
        out[f"lum_p{p}"] = round(float(np.percentile(Lk, p)), 4)
    out["lum_mean"] = round(float(Lk.mean()), 4)
    out["pct_above_90"] = round(float((Lk > 0.90).mean() * 100), 3)
    out["pct_below_5"] = round(float((Lk < 0.05).mean() * 100), 3)

    # --- saturation and split-tone hue ----------------------------------
    h, s, v = rgb_to_hsv(rgb)
    vis = keep & (v > 0.04)
    out["sat_mean"] = round(float(s[vis].mean()) if vis.any() else 0.0, 4)
    bands = {
        "shadows": (L < 0.25) & vis,
        "midtones": (L >= 0.25) & (L < 0.65) & vis,
        "highlights": (L >= 0.65) & vis,
    }
    for name, m in bands.items():
        if m.sum() < 16:
            out[f"hue_{name}"] = None
            out[f"sat_{name}"] = None
            out[f"hue_strength_{name}"] = 0.0
            continue
        hue, strength = circ_mean_hue(h[m], (s[m] * v[m]))
        out[f"hue_{name}"] = None if hue is None else round(hue, 1)
        out[f"sat_{name}"] = round(float(s[m].mean()), 4)
        # how concentrated the hue is (0 = colours cancel out, 1 = one hue)
        out[f"hue_strength_{name}"] = round(strength, 3)

    # --- glow falloff from the brightest element ------------------------
    Lb = blur(L, 2.0)
    thr = np.percentile(Lb, 99.7)
    ys, xs = np.nonzero(Lb >= thr)
    # centroid of the top-luminance pixels nearest the absolute maximum
    my, mx_ = np.unravel_index(np.argmax(Lb), Lb.shape)
    near = (np.hypot(ys - my, xs - mx_) < 0.08 * H)
    cy = float(ys[near].mean())
    cx = float(xs[near].mean())
    yy, xx = np.mgrid[0:H, 0:W]
    rr = np.hypot(yy - cy, xx - cx)
    nb = int(0.75 * H)
    prof = np.zeros(nb)
    for i in range(nb):
        ring = (rr >= i) & (rr < i + 1)
        prof[i] = L[ring].mean() if ring.any() else prof[i - 1]
    prof = np.maximum.accumulate(prof[::-1])[::-1]  # monotone envelope
    peak = prof[0]
    out["glow_center"] = [round(cx / W, 3), round(cy / H, 3)]
    out["glow_peak"] = round(float(peak), 4)
    for frac in (0.5, 0.25, 0.10):
        idx = np.nonzero(prof <= peak * frac)[0]
        # distance as a fraction of the frame height; None = never falls
        out[f"glow_r{int(frac * 100)}"] = (
            round(float(idx[0]) / H, 4) if len(idx) else None)

    # --- haze: contrast per third, and centre versus edge ----------------
    def contrast(m):
        vals = L[m & keep]
        if vals.size < 16:
            return None
        return round(float(np.percentile(vals, 95) - np.percentile(vals, 5)), 4)

    third = H // 3
    rows = np.zeros((H, W), dtype=int)
    rows[third:2 * third] = 1
    rows[2 * third:] = 2
    out["contrast_top"] = contrast(rows == 0)
    out["contrast_mid"] = contrast(rows == 1)
    out["contrast_bottom"] = contrast(rows == 2)
    centre = np.zeros((H, W), dtype=bool)
    centre[H // 4:3 * H // 4, W // 4:3 * W // 4] = True
    out["contrast_centre"] = contrast(centre)   # "near"/subject area
    out["contrast_edge"] = contrast(~centre)    # "far"/surround area
    out["contrast_full"] = contrast(np.ones((H, W), dtype=bool))

    # --- grain: high-pass std of the flattest lit area -------------------
    hp = L - blur(L, 1.5)
    gy, gx = np.gradient(blur(L, 3.0))
    grad = np.hypot(gy, gx)
    bs = 24
    cands = []
    for by in range(0, H - bs + 1, bs):
        for bx in range(0, W - bs + 1, bs):
            sl = (slice(by, by + bs), slice(bx, bx + bs))
            if not keep[sl].all():
                continue
            m = L[sl].mean()
            if m < 0.02 or m > 0.92:      # ignore pure black / clipped
                continue
            cands.append((grad[sl].mean(), hp[sl].std(), m))
    if cands:
        cands.sort(key=lambda c: c[0])
        n = max(1, len(cands) // 12)
        out["grain_std_8bit"] = round(
            float(np.median([c[1] for c in cands[:n]]) * 255), 3)
        out["grain_area_lum"] = round(
            float(np.median([c[2] for c in cands[:n]])), 4)
    else:
        out["grain_std_8bit"] = 0.0
        out["grain_area_lum"] = 0.0

    # --- detail: Laplacian variance over the frame ------------------------
    lap = (-4 * L[1:-1, 1:-1] + L[:-2, 1:-1] + L[2:, 1:-1]
           + L[1:-1, :-2] + L[1:-1, 2:]) * 255.0
    out["detail_lap_var"] = round(float(lap[keep[1:-1, 1:-1]].var()), 2)
    out["detail_hp_energy"] = round(float((hp[keep] * 255).std()), 3)

    # --- vignette: corner / centre brightness -----------------------------
    cw, ch = int(W * 0.12), int(H * 0.12)
    corners = np.concatenate([
        L[:ch, :cw].ravel(), L[:ch, -cw:].ravel(),
        L[-ch:, :cw].ravel(), L[-ch:, -cw:].ravel()])
    cen = L[int(H * 0.4):int(H * 0.6), int(W * 0.4):int(W * 0.6)]
    out["corner_mean"] = round(float(corners.mean()), 4)
    out["centre_mean"] = round(float(cen.mean()), 4)
    out["vignette_ratio"] = round(
        float(corners.mean() / max(cen.mean(), 1e-4)), 4)
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawTextHelpFormatter)
    ap.add_argument("frames", nargs="+")
    ap.add_argument("--json", help="write all results to this JSON file")
    ap.add_argument("--size", default="768x432")
    ap.add_argument("--mask", help="x0,y0,x1,y1 as fractions, excluded")
    a = ap.parse_args()
    size = tuple(int(v) for v in a.size.lower().split("x"))
    mask = [float(v) for v in a.mask.split(",")] if a.mask else None
    res = [measure(f, size, mask) for f in a.frames]
    if a.json:
        with open(a.json, "w") as fh:
            json.dump(res, fh, indent=1)
    keys = [k for k in res[0] if k not in ("file", "size")]
    w = max(len(k) for k in keys) + 1
    print("measure".ljust(w) + "".join(f"{i:>18}" for i in range(len(res))))
    for k in keys:
        print(k.ljust(w) + "".join(f"{str(r[k]):>18}" for r in res))
    for i, r in enumerate(res):
        print(f"[{i}] {r['file']}", file=sys.stderr)


if __name__ == "__main__":
    main()
