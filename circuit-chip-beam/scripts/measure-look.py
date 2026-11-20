#!/usr/bin/env python3
"""measure-look.py - measure light, atmosphere and texture of a frame.

Usage:
  measure-look.py FRAME.png                      # print measures as JSON
  measure-look.py REF.png OURS.png               # compare (difference + pass/fail at +-10% / +-10 deg)
  measure-look.py REF.png OURS.png --side-by-side out.png   # also save  ref | ours | difference
Options:
  --width N        normalise every image to this width before measuring (default 600, the
                   width of the reference previews) so pixel-scale measures are comparable
  --crop-aspect A  centre-crop every image to aspect ratio A (e.g. 1.899) before measuring
  --json FILE      write the numbers to FILE
  --skip a,b       measures to leave out of the pass/fail verdict (e.g. hue for a palette change)
Only numpy + Pillow are needed. All brightness values are sRGB-encoded Rec.709 luma, 0..1.
"""
import argparse, json, sys, colorsys
import numpy as np
from PIL import Image, ImageFilter


def load(path, width, crop_aspect):
    im = Image.open(path).convert("RGB")
    if crop_aspect:
        w, h = im.size
        if w / h > crop_aspect:
            nw = round(h * crop_aspect); x0 = (w - nw) // 2
            im = im.crop((x0, 0, x0 + nw, h))
        else:
            nh = round(w / crop_aspect); y0 = (h - nh) // 2
            im = im.crop((0, y0, w, y0 + nh))
    if width and im.size[0] != width:
        im = im.resize((width, round(im.size[1] * width / im.size[0])), Image.LANCZOS)
    return im


def luma(a):
    return a[..., 0] * 0.2126 + a[..., 1] * 0.7152 + a[..., 2] * 0.0722


def blur(arr, radius):
    im = Image.fromarray(np.clip(arr * 255, 0, 255).astype(np.uint8))
    return np.asarray(im.filter(ImageFilter.GaussianBlur(radius)), dtype=np.float64) / 255


def hue_sat(a):
    mx = a.max(-1); mn = a.min(-1); d = mx - mn
    sat = np.where(mx > 1e-6, d / np.maximum(mx, 1e-6), 0)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    dd = np.maximum(d, 1e-6)
    h = np.where(mx == r, ((g - b) / dd) % 6, np.where(mx == g, (b - r) / dd + 2, (r - g) / dd + 4)) * 60
    return h % 360, sat


def circ_mean_hue(h, w):
    if w.sum() < 1e-9:
        return float("nan")
    ang = np.deg2rad(h)
    return float(np.rad2deg(np.arctan2((np.sin(ang) * w).sum(), (np.cos(ang) * w).sum())) % 360)


def measure(im):
    a = np.asarray(im, dtype=np.float64) / 255
    H, W = a.shape[:2]
    L = luma(a)
    m = {}
    for p in (1, 5, 50, 95, 99):
        m[f"lum_p{p}"] = float(np.percentile(L, p))
    m["pct_above_90"] = float((L > 0.9).mean() * 100)
    m["pct_below_5"] = float((L < 0.05).mean() * 100)
    hue, sat = hue_sat(a)
    m["sat_mean"] = float(sat.mean())
    lo, hi = np.percentile(L, 33), np.percentile(L, 66)
    wgt = sat * a.max(-1)
    m["hue_shadows"] = circ_mean_hue(hue[L <= lo], wgt[L <= lo])
    m["hue_midtones"] = circ_mean_hue(hue[(L > lo) & (L <= hi)], wgt[(L > lo) & (L <= hi)])
    m["hue_highlights"] = circ_mean_hue(hue[L > hi], wgt[L > hi])

    # glow falloff: radial profile outward from the brightest element
    Ls = blur(L, max(1.5, W / 200))
    cy, cx = np.unravel_index(np.argmax(Ls), Ls.shape)
    yy, xx = np.mgrid[0:H, 0:W]
    r = np.hypot(xx - cx, yy - cy)
    nb = int(np.hypot(W, H) // 2)
    idx = np.minimum((r / 2).astype(int), nb - 1)
    prof = np.bincount(idx.ravel(), Ls.ravel(), nb) / np.maximum(np.bincount(idx.ravel(), minlength=nb), 1)
    peak = prof[0]
    m["glow_peak"] = float(peak)
    m["glow_cx"] = float(cx / W); m["glow_cy"] = float(cy / H)
    for frac in (50, 25, 10):
        below = np.where(prof <= peak * frac / 100)[0]
        m[f"glow_r{frac}"] = float(below[0] * 2 / W * 100) if len(below) else float("nan")  # % of frame width

    # haze: contrast (p95 - p5) per third, and near (bottom quarter) versus far (top quarter)
    def con(x):
        return float(np.percentile(x, 95) - np.percentile(x, 5))
    t = H // 3
    m["contrast_top"] = con(L[:t]); m["contrast_mid"] = con(L[t:2 * t]); m["contrast_bottom"] = con(L[2 * t:])
    m["contrast_far"] = con(L[: H // 4]); m["contrast_near"] = con(L[-(H // 4):])
    m["mean_top"] = float(L[:t].mean()); m["mean_mid"] = float(L[t:2 * t].mean()); m["mean_bottom"] = float(L[2 * t:].mean())

    # grain: std of the high-passed image in flat areas (10th percentile over 24px blocks)
    hp = L - blur(L, 1.5)
    bs = 24; stds = []
    for y in range(0, H - bs + 1, bs):
        for x in range(0, W - bs + 1, bs):
            blk = L[y:y + bs, x:x + bs]
            if 0.02 < blk.mean() < 0.9:
                stds.append(hp[y:y + bs, x:x + bs].std())
    m["grain"] = float(np.percentile(stds, 10)) if stds else 0.0

    # detail: Laplacian variance (x1e4)
    lap = (-4 * L[1:-1, 1:-1] + L[:-2, 1:-1] + L[2:, 1:-1] + L[1:-1, :-2] + L[1:-1, 2:])
    m["detail_lapvar"] = float(lap.var() * 1e4)

    # vignette: corners (10% boxes) / centre (20% box)
    bh, bw = max(1, H // 10), max(1, W // 10)
    corners = np.mean([L[:bh, :bw].mean(), L[:bh, -bw:].mean(), L[-bh:, :bw].mean(), L[-bh:, -bw:].mean()])
    centre = L[int(H * .4):int(H * .6), int(W * .4):int(W * .6)].mean()
    m["vignette_ratio"] = float(corners / max(centre, 1e-6))
    m["mean_lum"] = float(L.mean())
    return m


# absolute floors below which a relative difference is meaningless (near-zero values)
ABS_OK = {"lum_p1": .02, "lum_p5": .02, "lum_p50": .02, "lum_p95": .04, "lum_p99": .05, "pct_above_90": 0.5,
          "pct_below_5": 4.0, "sat_mean": .04, "glow_peak": .05, "glow_r50": 1.0, "glow_r25": 1.5, "glow_r10": 3.0,
          "contrast_top": .03, "contrast_mid": .03, "contrast_bottom": .03, "contrast_far": .03, "contrast_near": .03,
          "mean_top": .02, "mean_mid": .02, "mean_bottom": .02, "grain": .0015, "detail_lapvar": 0.0,
          "vignette_ratio": .06, "mean_lum": .02, "glow_cx": .08, "glow_cy": .08}


def compare(mr, mo, skip):
    rows = []; fails = 0
    for k in mr:
        r, o = mr[k], mo[k]
        if k.startswith("hue"):
            d = ((o - r + 180) % 360) - 180
            ok = abs(d) <= 10 or np.isnan(d); diff = f"{d:+.1f} deg"
        else:
            d = o - r; rel = d / r * 100 if abs(r) > 1e-9 else float("inf") if abs(d) > 1e-9 else 0
            ok = abs(rel) <= 10 or abs(d) <= ABS_OK.get(k, 0) or (np.isnan(r) and np.isnan(o)); diff = f"{rel:+.1f}%"
        skipped = any(k.startswith(s) for s in skip)
        if not ok and not skipped:
            fails += 1
        rows.append((k, r, o, diff, "skip" if skipped else ("ok" if ok else "FAIL")))
    return rows, fails


def side_by_side(ref, ours, out):
    a = np.asarray(ref, dtype=np.int16); b = np.asarray(ours.resize(ref.size, Image.LANCZOS), dtype=np.int16)
    diff = np.clip(np.abs(a - b) * 2, 0, 255).astype(np.uint8)
    canvas = np.concatenate([a.astype(np.uint8), b.astype(np.uint8), diff], axis=1)
    Image.fromarray(canvas).save(out)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("ref"); ap.add_argument("ours", nargs="?")
    ap.add_argument("--width", type=int, default=600)
    ap.add_argument("--crop-aspect", type=float, default=0)
    ap.add_argument("--json"); ap.add_argument("--side-by-side"); ap.add_argument("--skip", default="")
    ap.add_argument("--quiet", action="store_true")
    a = ap.parse_args()
    ref = load(a.ref, a.width, a.crop_aspect); mr = measure(ref)
    if not a.ours:
        print(json.dumps(mr, indent=1))
        if a.json:
            json.dump(mr, open(a.json, "w"), indent=1)
        return
    ours = load(a.ours, a.width, a.crop_aspect); mo = measure(ours)
    rows, fails = compare(mr, mo, [s for s in a.skip.split(",") if s])
    if not a.quiet:
        print(f"{'measure':18}{'reference':>11}{'ours':>11}{'diff':>12}  verdict")
        for k, r, o, d, v in rows:
            print(f"{k:18}{r:11.4f}{o:11.4f}{d:>12}  {v}")
    print(f"{fails} of {len(rows)} measures outside target")
    if a.json:
        json.dump({"reference": mr, "ours": mo, "rows": rows, "fails": fails}, open(a.json, "w"), indent=1)
    if a.side_by_side:
        side_by_side(ref, ours, a.side_by_side)


if __name__ == "__main__":
    main()
