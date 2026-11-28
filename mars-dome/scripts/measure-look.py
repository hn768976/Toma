#!/usr/bin/env python3
"""measure-look.py - measure the *look* of a frame (light, atmosphere, texture).

Dependencies: numpy + Pillow only.

Usage
  measure one frame      python3 scripts/measure-look.py measure frame.png [--json out.json]
  compare two frames     python3 scripts/measure-look.py compare ref.png mine.png
                             [--out lookdev/compare-start.png] [--json out.json]
                             [--skip hue,saturation]

Common options
  --width 768            analysis width. Every frame is resampled to this width first so
                         that a 768x432 reference and a 1920x1080 render are measured on
                         the same pixel grid (grain / detail / glow are scale dependent).
  --mask x0,y0,x1,y1     normalised rectangle to ignore (repeatable) - e.g. a watermark.
  --near x0,y0,x1,y1     normalised rectangle that is "near" the camera (haze measure).
  --far  x0,y0,x1,y1     normalised rectangle that is "far" from the camera.
  --glow x,y             normalised centre of the brightest element. Default: found
                         automatically (argmax of the blurred luminance).

All luminance values are Rec.709 luma of the sRGB-encoded pixel, on a 0-100 scale.
Distances are in % of frame height. Grain is in 8-bit code values.
"""
import argparse
import json
import math
import sys

import numpy as np
from PIL import Image

TOL_REL = 0.10  # +-10 %
TOL_HUE = 10.0  # +-10 degrees
# Absolute floors: when a value is tiny, a 10 % relative window is smaller than the
# measurement noise, so a small absolute window is also accepted.
ABS_FLOOR = {
    "lum": 2.0,       # luminance points (0-100)
    "pct": 1.0,       # percentage points of the frame
    "sat": 0.02,      # saturation (0-1)
    "dist": 1.0,      # % of frame height
    "contrast": 2.0,  # luminance points
    "grain": 0.25,    # 8-bit code values
    "detail": 1.5,    # laplacian variance, 8-bit^2
    "ratio": 0.05,    # vignette ratio
}


# ----------------------------------------------------------------------------- helpers
def load(path, width):
    img = Image.open(path).convert("RGB")
    if img.width != width:
        h = int(round(img.height * width / img.width))
        img = img.resize((width, h), Image.BOX if img.width > width else Image.BICUBIC)
    return np.asarray(img, dtype=np.float32) / 255.0


def luma(rgb):
    return rgb[..., 0] * 0.2126 + rgb[..., 1] * 0.7152 + rgb[..., 2] * 0.0722


def box_to_px(box, shape):
    h, w = shape[:2]
    x0, y0, x1, y1 = box
    return int(round(x0 * w)), int(round(y0 * h)), int(round(x1 * w)), int(round(y1 * h))


def make_valid(shape, masks):
    valid = np.ones(shape[:2], dtype=bool)
    for m in masks:
        x0, y0, x1, y1 = box_to_px(m, shape)
        valid[y0:y1, x0:x1] = False
    return valid


def gauss_kernel(sigma):
    r = max(1, int(math.ceil(sigma * 3)))
    x = np.arange(-r, r + 1, dtype=np.float32)
    k = np.exp(-(x * x) / (2 * sigma * sigma))
    return k / k.sum()


def blur(a, sigma):
    """Separable gaussian blur with edge replication (numpy only)."""
    k = gauss_kernel(sigma)
    r = len(k) // 2
    p = np.pad(a, ((0, 0), (r, r)), mode="edge")
    out = np.zeros_like(a)
    for i, w in enumerate(k):
        out += w * p[:, i:i + a.shape[1]]
    p = np.pad(out, ((r, r), (0, 0)), mode="edge")
    out2 = np.zeros_like(a)
    for i, w in enumerate(k):
        out2 += w * p[i:i + a.shape[0], :]
    return out2


def hue_sat(rgb):
    mx = rgb.max(-1)
    mn = rgb.min(-1)
    c = mx - mn
    sat = np.where(mx > 1e-6, c / np.maximum(mx, 1e-6), 0.0)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    safe = np.maximum(c, 1e-6)
    h = np.where(mx == r, ((g - b) / safe) % 6.0,
                 np.where(mx == g, (b - r) / safe + 2.0, (r - g) / safe + 4.0))
    return h * 60.0, sat, c


def circ_mean_hue(h, weight):
    if weight.sum() < 1e-6:
        return float("nan")
    a = np.deg2rad(h)
    s = (np.sin(a) * weight).sum()
    c = (np.cos(a) * weight).sum()
    return float(np.rad2deg(math.atan2(s, c)) % 360.0)


def pct(a, q):
    return float(np.percentile(a, q))


# ----------------------------------------------------------------------------- measures
def measure(path, width=768, masks=(), near=None, far=None, glow=None):
    rgb = load(path, width)
    h, w = rgb.shape[:2]
    Y = luma(rgb)
    valid = make_valid(rgb.shape, masks)
    Yv = Y[valid]
    out = {"file": path, "analysis_size": [w, h]}

    # 1. luminance percentiles -------------------------------------------------------
    for q in (1, 5, 50, 95, 99):
        out[f"lum_p{q}"] = pct(Yv, q) * 100.0
    # 2. how much glows / how much is dark -------------------------------------------
    out["pct_above_90"] = float((Yv > 0.90).mean() * 100.0)
    out["pct_below_5"] = float((Yv < 0.05).mean() * 100.0)

    # 3. saturation + hue of shadows / midtones / highlights (split toning) ----------
    hue, sat, chroma = hue_sat(rgb)
    out["saturation_mean"] = float(sat[valid].mean())
    p25, p75 = np.percentile(Yv, 25), np.percentile(Yv, 75)
    bands = {
        "hue_shadows": valid & (Y <= p25),
        "hue_midtones": valid & (Y > p25) & (Y < p75),
        "hue_highlights": valid & (Y >= p75),
    }
    for name, m in bands.items():
        out[name] = circ_mean_hue(hue[m], chroma[m])

    # 4. glow falloff from the brightest element -------------------------------------
    Yb = blur(Y, 1.5)
    if glow is None:
        cand = np.where(valid, Yb, -1.0)
        cy, cx = np.unravel_index(int(np.argmax(cand)), cand.shape)
    else:
        cx, cy = int(round(glow[0] * (w - 1))), int(round(glow[1] * (h - 1)))
    peak = float(Yb[cy, cx])
    bg = float(np.median(Yv))
    yy, xx = np.mgrid[0:h, 0:w]
    rr = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2)
    rmax = int(0.6 * h)
    ri = np.clip(rr.astype(np.int32), 0, rmax)
    sel = valid & (rr < rmax)
    sums = np.bincount(ri[sel], weights=Yb[sel], minlength=rmax + 1)
    cnts = np.bincount(ri[sel], minlength=rmax + 1)
    prof = sums / np.maximum(cnts, 1)
    rel = (prof - bg) / max(peak - bg, 1e-4)
    out["glow_centre"] = [cx / (w - 1), cy / (h - 1)]
    out["glow_peak"] = peak * 100.0
    for level, key in ((0.5, "glow_r50"), (0.25, "glow_r25"), (0.10, "glow_r10")):
        below = np.where((rel[1:] < level) & (cnts[1:] > 0))[0]
        r = (below[0] + 1) if len(below) else rmax
        out[key] = float(r) / h * 100.0

    # 5. haze: contrast by thirds and near vs far ------------------------------------
    def contrast(m):
        v = Y[m]
        return (pct(v, 95) - pct(v, 5)) * 100.0 if v.size > 16 else float("nan")

    third = h // 3
    rows = np.arange(h)[:, None] * np.ones((1, w), dtype=np.int32)
    out["contrast_top"] = contrast(valid & (rows < third))
    out["contrast_mid"] = contrast(valid & (rows >= third) & (rows < 2 * third))
    out["contrast_bottom"] = contrast(valid & (rows >= 2 * third))
    near = near or (0.2, 0.62, 0.8, 0.95)
    far = far or (0.2, 0.04, 0.8, 0.30)

    def boxmask(b):
        x0, y0, x1, y1 = box_to_px(b, rgb.shape)
        m = np.zeros((h, w), dtype=bool)
        m[y0:y1, x0:x1] = True
        return m & valid

    out["contrast_near"] = contrast(boxmask(near))
    out["contrast_far"] = contrast(boxmask(far))
    out["lum_near"] = float(Y[boxmask(near)].mean() * 100.0)
    out["lum_far"] = float(Y[boxmask(far)].mean() * 100.0)

    # 6. grain: std of the high-passed luma in the flattest areas --------------------
    hp = Y - blur(Y, 1.0)
    low = blur(Y, 3.0)
    gy, gx = np.gradient(low)
    flat = gx * gx + gy * gy
    bs = 24
    blocks = []
    for by in range(0, h - bs + 1, bs):
        for bx in range(0, w - bs + 1, bs):
            if not valid[by:by + bs, bx:bx + bs].all():
                continue
            m = float(Y[by:by + bs, bx:bx + bs].mean())
            if m < 0.08 or m > 0.92:
                continue
            blocks.append((float(flat[by:by + bs, bx:bx + bs].mean()),
                           float(hp[by:by + bs, bx:bx + bs].std())))
    if blocks:
        blocks.sort(key=lambda t: t[0])
        n = max(4, len(blocks) // 10)
        out["grain"] = float(np.median([b[1] for b in blocks[:n]]) * 255.0)
    else:
        out["grain"] = float("nan")

    # 7. detail: laplacian variance --------------------------------------------------
    lap = (-4.0 * Y[1:-1, 1:-1] + Y[:-2, 1:-1] + Y[2:, 1:-1] + Y[1:-1, :-2] + Y[1:-1, 2:]) * 255.0
    out["detail_laplacian_var"] = float(lap[valid[1:-1, 1:-1]].var())

    # 8. vignette: corners / centre --------------------------------------------------
    ch, cw = int(0.14 * h), int(0.14 * w)
    corners = [Y[:ch, :cw], Y[:ch, -cw:], Y[-ch:, :cw], Y[-ch:, -cw:]]
    cm = boxmask((0.35, 0.35, 0.65, 0.65))
    centre = float(Y[cm].mean()) if cm.any() else float(Y[int(.35 * h):int(.65 * h), int(.35 * w):int(.65 * w)].mean())
    out["vignette_ratio"] = float(np.mean([c.mean() for c in corners]) / max(centre, 1e-4))
    return out


KEYS = [
    ("lum_p1", "lum"), ("lum_p5", "lum"), ("lum_p50", "lum"), ("lum_p95", "lum"), ("lum_p99", "lum"),
    ("pct_above_90", "pct"), ("pct_below_5", "pct"),
    ("saturation_mean", "sat"),
    ("hue_shadows", "hue"), ("hue_midtones", "hue"), ("hue_highlights", "hue"),
    ("glow_r50", "dist"), ("glow_r25", "dist"), ("glow_r10", "dist"),
    ("contrast_top", "contrast"), ("contrast_mid", "contrast"), ("contrast_bottom", "contrast"),
    ("contrast_near", "contrast"), ("contrast_far", "contrast"),
    ("grain", "grain"),
    ("detail_laplacian_var", "detail"),
    ("vignette_ratio", "ratio"),
]
GROUPS = {
    "hue": ["hue_shadows", "hue_midtones", "hue_highlights"],
    "saturation": ["saturation_mean"],
    "glow": ["glow_r50", "glow_r25", "glow_r10"],
    "grain": ["grain"],
    "detail": ["detail_laplacian_var"],
    "vignette": ["vignette_ratio"],
    "haze": ["contrast_top", "contrast_mid", "contrast_bottom", "contrast_near", "contrast_far"],
}


def compare(ref, mine, skip=()):
    skipped = set()
    for s in skip:
        skipped.update(GROUPS.get(s, [s]))
    rows = []
    for key, kind in KEYS:
        a, b = ref[key], mine[key]
        if kind == "hue":
            d = ((b - a + 180.0) % 360.0) - 180.0
            ok = abs(d) <= TOL_HUE
            rel = None
        else:
            d = b - a
            rel = d / a * 100.0 if abs(a) > 1e-6 else float("inf") if abs(d) > 1e-6 else 0.0
            ok = abs(d) <= TOL_REL * abs(a) or abs(d) <= ABS_FLOOR[kind]
        status = "skip" if key in skipped else ("ok" if ok else "FAIL")
        rows.append({"measure": key, "ref": a, "mine": b, "diff": d, "diff_pct": rel, "status": status})
    return rows


def print_measure(m):
    for key, _ in KEYS:
        print(f"{key:24s} {m[key]:9.3f}")
    print(f"{'glow_centre':24s} {m['glow_centre'][0]:.3f},{m['glow_centre'][1]:.3f}  peak {m['glow_peak']:.1f}")
    print(f"{'lum_near / lum_far':24s} {m['lum_near']:.1f} / {m['lum_far']:.1f}")


def print_compare(rows):
    print(f"{'measure':24s} {'ref':>9s} {'mine':>9s} {'diff':>9s} {'diff%':>8s}  status")
    for r in rows:
        rel = "" if r["diff_pct"] is None else f"{r['diff_pct']:+7.1f}%"
        unit = "deg" if r["diff_pct"] is None else ""
        print(f"{r['measure']:24s} {r['ref']:9.3f} {r['mine']:9.3f} {r['diff']:+9.3f}{unit:3s} {rel:>8s}  {r['status']}")
    n_fail = sum(1 for r in rows if r["status"] == "FAIL")
    n_ok = sum(1 for r in rows if r["status"] == "ok")
    print(f"-> {n_ok} within target, {n_fail} outside, {len(rows) - n_ok - n_fail} skipped")


def side_by_side(ref_path, mine_path, out_path, width=960):
    a = Image.open(ref_path).convert("RGB")
    b = Image.open(mine_path).convert("RGB")
    h = int(round(a.height * width / a.width))
    a = a.resize((width, h), Image.BICUBIC)
    b = b.resize((width, h), Image.BOX if b.width > width else Image.BICUBIC)
    d = np.abs(np.asarray(a, dtype=np.int16) - np.asarray(b, dtype=np.int16))
    d = Image.fromarray(np.clip(d * 2, 0, 255).astype(np.uint8))
    gap = 8
    canvas = Image.new("RGB", (width * 3 + gap * 2, h), (255, 255, 255))
    canvas.paste(a, (0, 0))
    canvas.paste(b, (width + gap, 0))
    canvas.paste(d, (2 * (width + gap), 0))
    canvas.save(out_path)


def parse_box(s):
    v = [float(x) for x in s.split(",")]
    if len(v) != 4:
        raise argparse.ArgumentTypeError("expected x0,y0,x1,y1")
    return tuple(v)


def parse_pt(s):
    v = [float(x) for x in s.split(",")]
    if len(v) != 2:
        raise argparse.ArgumentTypeError("expected x,y")
    return tuple(v)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    for name in ("measure", "compare"):
        p = sub.add_parser(name)
        p.add_argument("image")
        if name == "compare":
            p.add_argument("image2")
            p.add_argument("--out", help="write a reference | mine | difference image")
            p.add_argument("--skip", default="", help="comma list of measures or groups to skip")
        p.add_argument("--json")
        p.add_argument("--width", type=int, default=768)
        p.add_argument("--mask", type=parse_box, action="append", default=[])
        p.add_argument("--near", type=parse_box)
        p.add_argument("--far", type=parse_box)
        p.add_argument("--glow", type=parse_pt)
        p.add_argument("--quiet", action="store_true")
    a = ap.parse_args()
    kw = dict(width=a.width, masks=a.mask, near=a.near, far=a.far)
    if a.cmd == "measure":
        m = measure(a.image, glow=a.glow, **kw)
        if not a.quiet:
            print_measure(m)
        if a.json:
            json.dump(m, open(a.json, "w"), indent=1)
        return 0
    ref = measure(a.image, glow=a.glow, **kw)
    # the glow profile of the attempt is measured around the same element as the reference
    mine = measure(a.image2, glow=a.glow or tuple(ref["glow_centre"]), **kw)
    rows = compare(ref, mine, [s for s in a.skip.split(",") if s])
    if not a.quiet:
        print_compare(rows)
    if a.out:
        side_by_side(a.image, a.image2, a.out)
    if a.json:
        json.dump({"ref": ref, "mine": mine, "rows": rows}, open(a.json, "w"), indent=1)
    return 0


if __name__ == "__main__":
    sys.exit(main())
