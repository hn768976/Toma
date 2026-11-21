#!/usr/bin/env python3
"""measure-look.py - measure the light, atmosphere and texture of a frame.

Usage:
  python3 scripts/measure-look.py frame.png [frame2.png ...] [--json out.json]
        [--width 898] [--mask x0,y0,x1,y1] [--near x0,y0,x1,y1] [--far x0,y0,x1,y1]

All rectangles are fractions of the frame (0..1). Every frame is first resized
to --width (default 898 px, the reference preview size) so numbers from a
1080p render and from a small reference clip are directly comparable.

--mask   excludes a rectangle (e.g. a stock watermark) from every measure.
--near / --far  name the areas used for the near-versus-far haze contrast.

Needs only numpy and Pillow.
"""
import argparse
import json
import sys

import numpy as np
from PIL import Image


def gauss_kernel(sigma):
    r = max(1, int(round(sigma * 3)))
    x = np.arange(-r, r + 1, dtype=np.float64)
    k = np.exp(-(x * x) / (2 * sigma * sigma))
    return k / k.sum()


def blur(img, sigma):
    """Separable Gaussian blur with edge replication (2D float array)."""
    k = gauss_kernel(sigma)
    r = len(k) // 2
    p = np.pad(img, ((0, 0), (r, r)), mode="edge")
    out = np.zeros_like(img)
    for i, w in enumerate(k):
        out += w * p[:, i:i + img.shape[1]]
    p = np.pad(out, ((r, r), (0, 0)), mode="edge")
    out2 = np.zeros_like(img)
    for i, w in enumerate(k):
        out2 += w * p[i:i + img.shape[0], :]
    return out2


def rgb_to_hsv(rgb):
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    mx = rgb.max(-1)
    mn = rgb.min(-1)
    d = mx - mn
    s = np.where(mx > 1e-6, d / np.maximum(mx, 1e-6), 0.0)
    h = np.zeros_like(mx)
    m = d > 1e-6
    rc = np.where(m, (mx - r) / np.maximum(d, 1e-6), 0)
    gc = np.where(m, (mx - g) / np.maximum(d, 1e-6), 0)
    bc = np.where(m, (mx - b) / np.maximum(d, 1e-6), 0)
    h = np.where(mx == r, bc - gc, np.where(mx == g, 2.0 + rc - bc, 4.0 + gc - rc))
    h = (h / 6.0) % 1.0
    h = np.where(m, h, 0.0)
    return h * 360.0, s, mx


def circ_mean_deg(h, w):
    """Saturation-weighted circular mean of hue (degrees)."""
    if w.sum() < 1e-9:
        return float("nan")
    a = np.deg2rad(h)
    x = (np.cos(a) * w).sum()
    y = (np.sin(a) * w).sum()
    return float(np.rad2deg(np.arctan2(y, x)) % 360.0)


def rect_px(rect, w, h):
    x0, y0, x1, y1 = rect
    return int(round(x0 * w)), int(round(y0 * h)), int(round(x1 * w)), int(round(y1 * h))


def contrast(lum, valid):
    v = lum[valid]
    if v.size < 16:
        return float("nan")
    return float(np.percentile(v, 95) - np.percentile(v, 5))


def measure(path, width=898, mask=None, near=None, far=None):
    im = Image.open(path).convert("RGB")
    if im.width != width:
        h = int(round(im.height * width / im.width))
        im = im.resize((width, h), Image.LANCZOS if im.width < width else Image.BOX)
    rgb = np.asarray(im, dtype=np.float64) / 255.0
    H, W = rgb.shape[:2]
    lum = 0.2126 * rgb[..., 0] + 0.7152 * rgb[..., 1] + 0.0722 * rgb[..., 2]
    valid = np.ones((H, W), dtype=bool)
    if mask:
        x0, y0, x1, y1 = rect_px(mask, W, H)
        valid[y0:y1, x0:x1] = False
    lv = lum[valid]
    out = {"file": path, "size": [W, H]}

    # --- tone ---------------------------------------------------------------
    for p in (1, 5, 50, 95, 99):
        out[f"lum_p{p}"] = float(np.percentile(lv, p))
    out["pct_above_90"] = float((lv > 0.9).mean() * 100)
    out["pct_below_05"] = float((lv < 0.05).mean() * 100)

    # --- colour -------------------------------------------------------------
    hue, sat, _ = rgb_to_hsv(rgb)
    out["sat_mean"] = float(sat[valid].mean())
    p25, p75 = np.percentile(lv, 25), np.percentile(lv, 75)
    zones = {
        "shadows": valid & (lum <= p25),
        "midtones": valid & (lum > p25) & (lum < p75),
        "highlights": valid & (lum >= p75),
    }
    for name, z in zones.items():
        out[f"hue_{name}"] = circ_mean_deg(hue[z], sat[z])
        out[f"sat_{name}"] = float(sat[z].mean()) if z.any() else float("nan")

    # --- glow falloff -------------------------------------------------------
    # brightest element = peak of a lightly blurred luminance; profile = mean
    # luminance in rings around it, relative to the frame median.
    soft = blur(np.where(valid, lum, np.median(lv)), 3.0)
    py, px = np.unravel_index(np.argmax(soft), soft.shape)
    peak = soft[py, px]
    base = float(np.median(lv))
    yy, xx = np.mgrid[0:H, 0:W]
    dist = np.hypot(yy - py, xx - px)
    maxr = int(np.hypot(H, W))
    ring = np.minimum(dist.astype(int), maxr)
    sums = np.bincount(ring[valid].ravel(), weights=lum[valid].ravel(), minlength=maxr + 1)
    cnts = np.bincount(ring[valid].ravel(), minlength=maxr + 1)
    prof = np.where(cnts > 0, sums / np.maximum(cnts, 1), np.nan)
    # light smoothing of the profile
    pf = np.array([np.nanmean(prof[max(0, i - 1):i + 2]) for i in range(len(prof))])
    amp = max(peak - base, 1e-6)
    out["glow_peak_xy"] = [float(px / W), float(py / H)]
    out["glow_peak_lum"] = float(peak)
    for frac in (50, 25, 10):
        thr = base + amp * frac / 100.0
        below = np.where(pf[1:] <= thr)[0]
        d = float(below[0] + 1) if below.size else float(maxr)
        out[f"glow_r{frac}_pct_w"] = d / W * 100.0

    # --- haze / depth fade --------------------------------------------------
    t = H // 3
    out["contrast_top"] = contrast(lum[:t], valid[:t])
    out["contrast_mid"] = contrast(lum[t:2 * t], valid[t:2 * t])
    out["contrast_bottom"] = contrast(lum[2 * t:], valid[2 * t:])
    near = near or (0.25, 0.70, 0.75, 1.0)
    far = far or (0.25, 0.0, 0.75, 0.30)
    for name, r in (("near", near), ("far", far)):
        x0, y0, x1, y1 = rect_px(r, W, H)
        out[f"contrast_{name}"] = contrast(lum[y0:y1, x0:x1], valid[y0:y1, x0:x1])
        out[f"lum_{name}"] = float(lum[y0:y1, x0:x1][valid[y0:y1, x0:x1]].mean())

    # --- grain --------------------------------------------------------------
    # flattest 40x40 patch (lowest low-frequency gradient), then the standard
    # deviation of the high-pass (luma minus a 1.5px Gaussian) inside it.
    low = blur(lum, 2.5)
    gy, gx = np.gradient(low)
    gmag = np.hypot(gx, gy)
    ps = 40
    best, bxy = None, (0, 0)
    for y in range(0, H - ps, ps // 2):
        for x in range(0, W - ps, ps // 2):
            if not valid[y:y + ps, x:x + ps].all():
                continue
            m = lum[y:y + ps, x:x + ps].mean()
            if m < 0.08 or m > 0.92:
                continue  # grain is faded/clipped in near-black and near-white
            e = gmag[y:y + ps, x:x + ps].mean()
            if best is None or e < best:
                best, bxy = e, (x, y)
    hp = lum - blur(lum, 1.5)
    x, y = bxy
    out["grain_patch_xy"] = [x, y]
    out["grain_std_255"] = float(hp[y:y + ps, x:x + ps].std() * 255.0)
    out["grain_std_frame_255"] = float(np.median(
        [hp[j:j + ps, i:i + ps].std() for j in range(0, H - ps, ps) for i in range(0, W - ps, ps)
         if valid[j:j + ps, i:i + ps].all()]) * 255.0)

    # --- detail -------------------------------------------------------------
    L = lum * 255.0
    lap = (-4 * L[1:-1, 1:-1] + L[:-2, 1:-1] + L[2:, 1:-1] + L[1:-1, :-2] + L[1:-1, 2:])
    out["laplacian_var"] = float(lap[valid[1:-1, 1:-1]].var())
    g = np.hypot(*np.gradient(L))
    out["gradient_mean"] = float(g[valid].mean())

    # --- vignette -----------------------------------------------------------
    cs_y, cs_x = int(H * 0.12), int(W * 0.12)
    corners = [lum[:cs_y, :cs_x], lum[:cs_y, -cs_x:], lum[-cs_y:, :cs_x], lum[-cs_y:, -cs_x:]]
    cy0, cy1, cx0, cx1 = int(H * 0.38), int(H * 0.62), int(W * 0.38), int(W * 0.62)
    cen = lum[cy0:cy1, cx0:cx1][valid[cy0:cy1, cx0:cx1]]
    centre = float(cen.mean()) if cen.size else float(lum[cy0:cy1, cx0:cx1].mean())
    out["vignette_ratio"] = float(np.mean([c.mean() for c in corners]) / max(centre, 1e-6))
    out["lum_mean"] = float(lv.mean())
    # mean colour, handy for palette work
    out["rgb_mean"] = [float(c) for c in rgb[valid].mean(0)]
    return out


def parse_rect(s):
    if s is None:
        return None
    v = [float(x) for x in s.split(",")]
    if len(v) != 4:
        raise argparse.ArgumentTypeError("rect needs x0,y0,x1,y1")
    return tuple(v)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("frames", nargs="+")
    ap.add_argument("--json")
    ap.add_argument("--width", type=int, default=898)
    ap.add_argument("--mask", type=parse_rect)
    ap.add_argument("--near", type=parse_rect)
    ap.add_argument("--far", type=parse_rect)
    a = ap.parse_args()
    res = [measure(f, a.width, a.mask, a.near, a.far) for f in a.frames]
    if a.json:
        with open(a.json, "w") as fh:
            json.dump(res, fh, indent=1)
    keys = [k for k in res[0] if k not in ("file", "size", "glow_peak_xy", "grain_patch_xy", "rgb_mean")]
    names = [r["file"].split("/")[-1][-18:] for r in res]
    print(f"{'measure':24s}" + "".join(f"{n:>20s}" for n in names))
    for k in keys:
        print(f"{k:24s}" + "".join(f"{r[k]:20.4f}" for r in res))
    return 0


if __name__ == "__main__":
    sys.exit(main())
