"""Mountain lake at dusk — impasto oil (OilPainting). Calm, horizontal dusk sky; directional
strokes follow the forms (ridges along their slopes, pines upward, water flat)."""
import os
import sys
import time

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
import numpy as np

import drawkit
from drawkit import Scaler, seed_all, save_png
from oilpaint import OilPainting, hexc
from core import noise2d, smoothstep, polygon_mask

STYLE = "Impasto oil · 油画厚涂"
LIB = "oilpaint"

WL = 640.0   # waterline (design px)


def far_ridge(x):
    """far range top edge (design px): peaks ~300-380, highest ~1250"""
    y = 372 - 70 * np.exp(-((x - 1250) / 170) ** 2) - 40 * np.exp(-((x - 820) / 140) ** 2) \
        - 34 * np.exp(-((x - 1620) / 150) ** 2) - 30 * np.exp(-((x - 300) / 180) ** 2) \
        - 6 * np.sin(x / 37) - 4 * np.sin(x / 13 + 1)
    return y


def near_ridge(x):
    """near range: big left shoulder 0-900, dipping right"""
    y = 470 - 30 * np.exp(-((x - 330) / 260) ** 2) - 14 * np.exp(-((x - 720) / 120) ** 2) \
        + 120 * smoothstep(850, 1500, x) - 50 * np.exp(-((x - 1720) / 150) ** 2) \
        - 4 * np.sin(x / 29) - 3 * np.sin(x / 11 + 2)
    return y


PINES_L = [(70, 520, 34), (130, 470, 46), (190, 430, 52), (250, 455, 48), (300, 500, 40),
           (355, 470, 44), (410, 520, 36), (460, 545, 30), (505, 560, 24), (30, 560, 26)]
PINES_R = [(1520, 580, 18), (1565, 560, 22), (1610, 590, 16), (1700, 575, 20), (1760, 600, 14)]


def pine_field(X, Y):
    """mask of pines (design coords), plus 'local x' for lighting"""
    m = np.zeros(X.shape, bool); lit = np.zeros(X.shape, np.float32)
    for (px, top, hw) in PINES_L + PINES_R:
        root = 652.0
        t = np.clip((Y - top) / (root - top), 0, 1)
        # tiered silhouette: width grows downward with saw-tooth tiers
        tiers = 1 - 0.35 * ((t * 7) % 1.0)
        half = hw * (0.08 + 0.92 * t ** 0.85) * tiers
        half = np.where(t > 0.93, hw * 0.12, half)          # trunk at the root
        inside = (np.abs(X - px) < half) & (Y >= top) & (Y <= root)
        m |= inside
        lit = np.where(inside, np.clip((X - px) / (hw + 1e-3), -1, 1), lit)
    return m, lit


def scene_above(X, Y, n1, n2):
    """reference colour + flow angle for everything above the waterline, evaluated at (X, Y) design coords"""
    ref = np.zeros(X.shape + (3,), np.float32)
    ang = np.zeros(X.shape, np.float32)
    # sky: deep blue-violet high, mauve, rose, peach at the horizon
    t = np.clip(Y / WL, 0, 1)
    stops = [(0.0, '#283462'), (0.22, '#44497e'), (0.40, '#8d6c9a'), (0.53, '#d8908e'), (0.66, '#f3b48c'), (1.0, '#f8cf98')]
    for (a, ca), (b, cb) in zip(stops[:-1], stops[1:]):
        k = np.clip((t - a) / (b - a), 0, 1)[..., None]
        sel = ((t >= a) & (t <= b))[..., None]
        ref = np.where(sel, hexc(ca) * (1 - k) + hexc(cb) * k, ref)
    # soft horizontal cloud banks
    band = smoothstep(0.55, 0.8, n1) * np.exp(-((Y - 250) / 120) ** 2)
    ref = ref * (1 - 0.35 * band[..., None]) + hexc('#c78a9c') * 0.35 * band[..., None]
    band2 = smoothstep(0.6, 0.85, n2) * np.exp(-((Y - 470) / 70) ** 2)
    ref = ref * (1 - 0.4 * band2[..., None]) + hexc('#f6cf9e') * 0.4 * band2[..., None]
    # sun glow behind the far range
    rg = np.hypot(X - 1240, (Y - 560) * 1.3)
    glow = np.exp(-(rg / 260) ** 2)
    ref = ref * (1 - 0.6 * glow[..., None]) + hexc('#ffe0a8') * 0.6 * glow[..., None]
    ang[:] = 0.06 * np.sin(X / 260 + Y / 140) + 0.08 * (n1 - 0.5)       # calm, nearly horizontal

    # far range: pale hazy lavender, strokes follow the slope
    fy = far_ridge(X)
    far = (Y > fy) & (Y < WL + 2)
    dfy = np.gradient(far_ridge(np.arange(-2, 1925, dtype=np.float32)))
    slope = np.interp(X, np.arange(-2, 1925), dfy)
    depth = np.clip((Y - fy) / 160, 0, 1)
    fcol = (hexc('#7f7aa6') * (1 - depth[..., None]) + hexc('#a98fae') * depth[..., None])
    fcol = fcol * (0.94 + 0.12 * n2[..., None])
    lightside = slope < 0     # faces the glow on its right? lit faces on the left slopes
    fcol = np.where(lightside[..., None], fcol * 1.05, fcol * 0.95)
    ref = np.where(far[..., None], fcol, ref)
    ang = np.where(far, np.arctan(slope) * (1 - depth) + 0.05 * depth, ang)

    # near range: darker plum-blue, mossy at the base
    ny = near_ridge(X)
    near = (Y > ny) & (Y < WL + 2)
    dny = np.gradient(near_ridge(np.arange(-2, 1925, dtype=np.float32)))
    nslope = np.interp(X, np.arange(-2, 1925), dny)
    nd = np.clip((Y - ny) / 140, 0, 1)
    ncol = hexc('#4f4f78') * (1 - nd[..., None]) + hexc('#3b4560') * nd[..., None]
    ncol = ncol * (0.9 + 0.2 * n2[..., None])
    rim = np.exp(-((Y - ny) / 10) ** 2) * (nslope < 0.05)
    ncol = ncol * (1 - 0.35 * rim[..., None]) + hexc('#c98e86') * 0.35 * rim[..., None]
    ref = np.where(near[..., None], ncol, ref)
    ang = np.where(near, np.arctan(nslope) * (1 - nd) + (np.pi / 2 - 0.4) * nd * 0.5, ang)

    # shore strip
    shore = (Y > WL - 10) & (Y < WL + 2) & ((X < 640) | (X > 1460))
    ref = np.where(shore[..., None], hexc('#2a2f2c'), ref)
    ang = np.where(shore, 0.0, ang)

    # pines: deep green-blue, warm rim on the right (glow side)
    pm, lit = pine_field(X, Y)
    pcol = hexc('#14241f') * (0.85 + 0.3 * n2[..., None])
    pcol = pcol * (1 - 0.3 * smoothstep(0.35, 1, lit)[..., None]) + hexc('#7a5a4a') * 0.3 * smoothstep(0.35, 1, lit)[..., None]
    ref = np.where(pm[..., None], pcol, ref)
    ang = np.where(pm, np.where(lit >= 0, 0.55, np.pi - 0.55) + 0.2 * (n2 - 0.5), ang)   # drooping branch strokes
    return ref, ang, pm


def paint(W=1920, H=1080, seed=1, stages_dir=None):
    seed_all(seed)
    S = Scaler(W, H)
    s = S.s
    o = OilPainting(W, H, seed=seed)
    X = o.XX / s; Y = o.YY / s                       # design coordinates per pixel
    n1 = noise2d(H, W, 220 * s, 3, seed + 1)
    n2 = noise2d(H, W, 60 * s, 3, seed + 2)
    n3 = noise2d(H, W, 30 * s, 2, seed + 3)

    ref, ang, pm = scene_above(X, Y, n1, n2)

    # ---- water: mirrored scene, wobbled sideways, darker toward the viewer
    water = Y >= WL
    d = np.clip((Y - WL) / (1080 - WL), 0, 1)
    wob = 6 * np.sin(Y / 7.0 + 3 * n3) * (0.3 + d)
    Xr = X + wob
    Yr = 2 * WL - Y
    rref, _, _ = scene_above(Xr, np.maximum(Yr, -400), n1, n2)
    # beyond the mirrored sky top, continue the darkest sky blue
    dark = hexc('#1c2546')
    wcol = rref * 0.8 * (1 - 0.85 * d[..., None] ** 0.9) + dark * 0.85 * d[..., None] ** 0.9
    # ripple lines catching the glow
    rip = smoothstep(0.72, 0.9, n3) * (np.abs(np.sin(Y / 5.5)) > 0.8)
    wcol = wcol * (1 - 0.3 * rip[..., None]) + hexc('#f0c49a') * 0.3 * rip[..., None] * (1 - d[..., None])
    # the glow's long vertical reflection under the sun
    gl = np.exp(-((X - 1240 - 0.5 * wob) / 120) ** 2) * np.exp(-((Y - WL) / 260) ** 2) * (0.6 + 0.6 * n3)
    wcol = wcol * (1 - 0.45 * gl[..., None]) + hexc('#f6c995') * 0.45 * gl[..., None]
    ref = np.where(water[..., None], wcol, ref)
    ang = np.where(water, 0.02 * np.sin(X / 90), ang)

    # ---- mist: soft horizontal band 600-700, thicker on the left
    mist = np.exp(-((Y - 650) / 38) ** 2) * (0.75 - 0.5 * smoothstep(200, 1500, X)) * (0.7 + 0.5 * n1)
    mist = np.clip(mist, 0, 0.8)
    ref = ref * (1 - mist[..., None]) + hexc('#e6c2bd') * mist[..., None]
    ang = np.where(mist > 0.2, 0.0, ang)

    # ---- boat (centre-right, waterline 800, length ~180) and its reflection
    hull = S.pts([(1080, 780), (1262, 778), (1240, 800), (1100, 801)])
    hm = polygon_mask(H, W, hull, 2) > 0.5
    hull_t = np.clip((Y - 780) / 22, 0, 1)[..., None]
    ref = np.where(hm[..., None], (hexc('#9a5a3a') * (1 - hull_t) + hexc('#4a2a20') * hull_t) * (0.9 + 0.2 * n3[..., None]), ref)
    gun = (np.abs(Y - 781) < 3) & hm
    ref = np.where(gun[..., None], hexc('#e0a070'), ref)
    ang = np.where(hm, 0.0, ang)
    hrefl = S.pts([(1100, 802), (1240, 802), (1258, 826), (1084, 828)])
    hr = polygon_mask(H, W, hrefl, 2) > 0.5
    ref = np.where(hr[..., None], ref * 0.45 + hexc('#2a1c1e') * 0.55, ref)
    # seated figure
    fig = (np.hypot(X - 1172, (Y - 762) * 0.9) < 17)
    head = np.hypot(X - 1172, Y - 736) < 8
    fm = (fig & (Y < 781)) | head
    ref = np.where(fm[..., None], hexc('#2b2430'), ref)
    ref = np.where((head & (X > 1173))[..., None], hexc('#b57360'), ref)
    figr = (np.hypot(X - 1172, (Y - 820) * 0.9) < 15) & (Y > 802) & (Y < 840)
    ref = np.where(figr[..., None], ref * 0.6 + hexc('#241c22') * 0.4, ref)

    # ---- reeds bottom-left
    reed = np.zeros((H, W), bool)
    for i in range(26):
        rx = 15 + i * 11 + 6 * np.sin(i * 2.3)
        top = 945 + 40 * abs(np.sin(i * 1.7))
        lean = 0.12 * np.sin(i * 1.3)
        cx = rx + (Y - 1080) * -lean
        reed |= (np.abs(X - cx) < 2.6) & (Y > top)
    ref = np.where(reed[..., None], hexc('#3b3322') * (0.8 + 0.5 * n3[..., None]), ref)
    ang = np.where(reed, -np.pi / 2, ang)

    # ---- toned ground (imprimatura) so gaps between strokes read as paint, not raw canvas
    from core import blur
    o.canvas = np.stack([blur(ref[..., c], 6 * s) for c in range(3)], -1) * 0.85
    # ---- paint: big -> medium -> detail strokes (all sizes scaled to the canvas)
    L = lambda a, b: (a * s, b * s)
    o.layer(ref, ang, length=L(60, 110), width=L(20, 30), density=2.8, value_jitter=0.04, jitter=0.05)
    o.stage('underpainting')
    o.layer(ref, ang, length=L(32, 62), width=L(10, 16), density=1.9, value_jitter=0.05, jitter=0.05)
    o.stage('sky_mountains_water')
    edges = np.zeros((H, W), np.float32)
    edges[(np.abs(Y - far_ridge(X)) < 18) | (np.abs(Y - near_ridge(X)) < 18)] = 1
    detail = (pm | reed | hm | hr | fm | figr | (np.abs(Y - WL) < 14)).astype(np.float32)
    o.layer(ref, ang, length=L(14, 30), width=L(5, 8), density=1.6, value_jitter=0.05, mask=np.maximum(detail, edges))
    o.stage('pines_boat_detail')
    # ridges catching the glow & ripples
    o.layer(ref, ang, length=L(10, 22), width=L(3.5, 6), density=0.9, value_jitter=0.04,
            mask=((hm | fm | reed | pm)).astype(np.float32), thickness=0.9)
    # crisp ripple highlights across the water
    rng = np.random.default_rng(seed + 7)
    for _ in range(22):
        rx = rng.uniform(560, 1700); ry = rng.uniform(690, 1040)
        dd = (ry - WL) / 440
        ln = rng.uniform(30, 90) * (0.6 + dd)
        col = hexc('#d9a68e') * (1 - dd) + hexc('#3e3c62') * dd
        o.stroke_at(S(rx), S(ry), 0.0, S(ln), S(3.5 + 3 * dd), col, 0.8)
    o.stage('ripples')
    # pines: explicit tiered branch strokes (drooping outward), dark trunk, warm rim on the glow side
    for (px, top, hw) in PINES_L + PINES_R:
        hgt = 650 - top
        n = max(4, int(hgt / 14))
        for k in range(n):
            t = (k + 0.5) / n
            yy = top + t * hgt * 0.92
            half = hw * (0.12 + 0.88 * t ** 0.85)
            g = float(rng.uniform(0.85, 1.15))
            for side in (-1, 1):
                ln = half * 1.15
                ang_b = 0.42 if side > 0 else np.pi - 0.42
                col = hexc('#18302a') * g if side < 0 else hexc('#24382e') * g * 0.8 + hexc('#8a5e4c') * 0.2 * (t < 0.9)
                o.stroke_at(S(px + side * ln * 0.45), S(yy), ang_b, S(ln), S(max(4, hgt / n * 0.9)), np.clip(col, 0, 1), 0.9)
        o.stroke_at(S(px), S(top + hgt * 0.45), -np.pi / 2, S(hgt * 0.9), S(max(3, hw * 0.12)), hexc('#121d1a'), 0.8)
        # its reflection: a softer, shorter mirrored silhouette in the water
        for k in range(n):
            t = (k + 0.5) / n
            yy = 2 * 652 - (top + t * hgt * 0.92)
            if yy > 880: continue
            half = hw * (0.12 + 0.88 * t ** 0.85)
            col = np.clip(hexc('#1f2a36') * 0.8 + hexc('#3a3a5c') * 0.2, 0, 1)
            o.stroke_at(S(px + rng.uniform(-4, 4)), S(yy), 0.0, S(half * 2.1), S(max(4, hgt / n * 0.8)), col, 0.7)
    o.stage('pines')
    # mist drifting across the shore and the reflections (thicker on the left)
    mref = ref * 0.35 + hexc('#e2c0bc') * 0.65
    o.layer(mref, np.zeros_like(ang), length=L(50, 110), width=L(4, 8), density=0.9, value_jitter=0.03,
            mask=((mist > 0.3) & (Y > 605)).astype(np.float32), thickness=0.6)
    o.stage('mist')
    # oar
    o.stroke_at(S(1205), S(790), 0.42, S(70), S(4), '#6a4030', 1.0)
    # birds: two short dark strokes each
    for (bx, by, sc) in [(1380, 230, 1.0), (1450, 200, 0.85), (1530, 255, 0.9), (1610, 215, 0.7), (1670, 280, 0.65)]:
        o.stroke_at(S(bx - 9 * sc), S(by), 0.5, S(22 * sc), S(5 * sc), '#2a2234', 1.2)
        o.stroke_at(S(bx + 9 * sc), S(by), -0.5, S(22 * sc), S(5 * sc), '#2a2234', 1.2)
    o.stage('birds')

    img = o.composite()
    if stages_dir:
        os.makedirs(stages_dir, exist_ok=True)
        for i, (name, im) in enumerate(o.stages):
            save_png(im, f"{stages_dir}/{i:02d}_{name}.png")
    return img


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else 'oilpaint_lake.png'
    W = int(sys.argv[2]) if len(sys.argv) > 2 else 1920
    H = int(sys.argv[3]) if len(sys.argv) > 3 else 1080
    st = sys.argv[4] if len(sys.argv) > 4 else None
    t0 = time.perf_counter()
    img = paint(W, H, seed=1, stages_dir=st)
    print(f"paint {time.perf_counter() - t0:.2f}s")
    save_png(img, out)
