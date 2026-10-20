"""Mountain lake at dusk, as a ballpoint doodle: blue/black ballpoint outlines on copy paper, coloured in with
quick diagonal coloured-pencil hatching (pencil can only darken, so the mist and glow are left as paper)."""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
import numpy as np

import drawkit
from drawkit import Scaler, seed_all, save_png

from ballpoint import Ballpoint
from core import spline, blur, smoothstep, fbm1d, noise2d

STYLE = "Ballpoint doodle · 圆珠笔涂鸦"
LIB = "ballpoint"

WL = 640.0          # waterline (design px)


def ridge(xs, peaks, base, rng, rough=6.0):
    """ridge height y(x) from (x, y) control peaks plus a little ballpoint wobble"""
    px = [p[0] for p in peaks]; py = [p[1] for p in peaks]
    y = np.interp(xs, px, py)
    y = y + fbm1d(len(xs), max(4, len(xs) / 12), 3, int(rng.integers(1 << 30))) * rough
    return np.minimum(y, base)


def paint(W=1920, H=1080, seed=1, stages_dir=None):
    seed_all(seed)
    S = Scaler(W, H)
    s = S.s
    b = Ballpoint(W, H, seed=seed, ss=2, pen_width=2.5 * s)
    g = np.random.default_rng(seed + 101)      # geometry rng (independent of drawing order)
    YY = np.arange(H, dtype=np.float32)[:, None] * np.ones((1, W), np.float32)
    XX = np.arange(W, dtype=np.float32)[None, :] * np.ones((H, 1), np.float32)
    wl = S(WL)

    def P(v):                         # design-unit hatch args -> canvas px
        return v * s

    def pen(pts, colour='blue', pr=0.8, **kw):
        b.line(np.asarray(pts, np.float32) * s, colour, pr, **kw)

    def hatch(mask, colour, angle, pressure, spacing=4.0, length=(40, 90), overshoot=4.0, **kw):
        b.pencil(mask, colour, angle=angle, pressure=pressure, spacing=P(spacing),
                 length=(P(length[0]), P(length[1])), overshoot=P(overshoot), width=P(2.9), **kw)

    b.paper(cockle=0.6, folds=[], vignette=0.05)

    # ------------------------------------------------------------------ geometry
    xs = np.linspace(-20, 1940, 200)
    far_y = ridge(xs, [(-20, 420), (120, 372), (300, 345), (430, 380), (600, 330), (760, 365), (900, 352),
                       (1050, 318), (1250, 296), (1380, 330), (1520, 312), (1680, 362), (1820, 340), (1940, 380)],
                  WL, g, 7)
    near_y = ridge(xs, [(-20, 470), (140, 438), (330, 452), (520, 430), (700, 448), (900, 486), (1060, 530),
                        (1200, 560), (1320, 548), (1460, 585), (1600, 572), (1760, 605), (1940, 615)], WL, g, 5)
    far_pts = np.stack([xs, far_y], 1)
    near_pts = np.stack([xs, near_y], 1)
    far_m = b.poly(S.pts(list(map(tuple, far_pts)) + [(1940, WL + 2), (-20, WL + 2)]))
    near_m = b.poly(S.pts(list(map(tuple, near_pts)) + [(1940, WL + 2), (-20, WL + 2)]))
    far_only = np.clip(far_m - near_m, 0, 1)
    sky_m = np.clip(1 - far_m, 0, 1) * (YY < wl)
    water_m = (YY >= wl).astype(np.float32)

    # mist band over the waterline, thicker at left (pencil is lifted there: paper shows through)
    mist_c = wl + S(10)
    mist_w = S(50) + S(55) * (1 - XX / W)
    mist = np.exp(-((YY - mist_c) / mist_w) ** 2) * (0.45 + 0.5 * (1 - XX / W))
    keep = np.clip(1 - mist, 0, 1)

    # pines: (x, root y, height, half-width)
    PINES = [(70, 652, 200, 40), (140, 655, 235, 46), (215, 650, 180, 36), (285, 656, 215, 42), (350, 652, 160, 32),
             (410, 655, 140, 30), (470, 650, 110, 24), (520, 652, 92, 20),
             (1510, 646, 80, 17), (1570, 648, 108, 22), (1640, 645, 70, 15), (1750, 647, 92, 19)]

    def pine_outline(x, y0, h, hw, flip=1.0):
        """zigzag conifer silhouette (design px), tip at top; flip=-1 for the reflection"""
        tiers = 5 if h > 120 else 4
        L, R = [], []
        top = y0 - h * flip
        for k in range(tiers + 1):
            t = k / tiers
            yy = top + (y0 - top) * (0.08 + 0.86 * t)
            w = hw * (0.12 + 0.88 * t) * (1 + g.normal(0, 0.06))
            L.append((x - w, yy)); R.append((x + w, yy))
            if k < tiers:
                yi = yy + (y0 - top) * 0.86 / tiers * 0.45
                wi = w * 0.55 + hw * 0.08
                L.append((x - wi, yi)); R.append((x + wi, yi))
        trunk = [(x + hw * 0.1, y0 - 4 * flip), (x + hw * 0.1, y0), (x - hw * 0.1, y0), (x - hw * 0.1, y0 - 4 * flip)]
        return [(x, top)] + R + trunk[:2] + trunk[2:] + L[::-1]

    pine_geo = [pine_outline(*p) for p in PINES]
    pine_ref = [pine_outline(x, 2 * WL - y0 + 8, h * 0.9, hw, -1.0) for (x, y0, h, hw) in PINES]
    pines_m = np.clip(sum(b.poly(S.pts(o), 0.6) for o in pine_geo), 0, 1)
    pref_m = np.clip(sum(b.poly(S.pts(o), 0.6) for o in pine_ref), 0, 1) * water_m

    # boat (design px): hull from bow (right) to stern, waterline y≈800
    BX, BY, BL = 1170.0, 800.0, 180.0
    hull = [(BX - BL / 2, BY - 22), (BX - BL / 2 + 14, BY - 2), (BX - 40, BY + 8), (BX + 40, BY + 8),
            (BX + BL / 2 - 6, BY - 6), (BX + BL / 2 + 6, BY - 30), (BX + 20, BY - 16), (BX - 60, BY - 16)]
    hull_m = b.poly(S.pts(spline(hull + hull[:1], 6)))
    hull_ref = [(x, 2 * BY - y + 4) for (x, y) in hull]
    hullr_m = b.poly(S.pts(spline(hull_ref + hull_ref[:1], 6)))
    fig_m = np.clip(b.ellipse(S(BX - 12), S(BY - 36), S(13), S(22)) + b.ellipse(S(BX - 10), S(BY - 66), S(8.5)), 0, 1)
    boat_m = np.clip(hull_m + fig_m, 0, 1)
    excl = 1 - smoothstep(0.05, 0.35, blur(np.clip(boat_m + hullr_m, 0, 1), P(2.0)))

    # reflection masks (mirror around the waterline, squashed a little)
    def mirror(M, squash=0.85):
        out = np.zeros_like(M)
        rows = np.arange(H)
        src = wl - (rows - wl) / squash
        ok = (rows >= wl) & (src >= 0)
        out[rows[ok]] = M[np.clip(src[ok].astype(int), 0, H - 1)]
        return out

    far_ref = mirror(far_only) * water_m
    near_ref = mirror(near_m) * water_m

    # ------------------------------------------------------------------ 1. ballpoint: the line drawing
    pen(far_pts, 'blue', 0.55, smooth=False, wobble=0.4, hook=0.2, skip=0.8)
    b.stage('pen_far_mountains')
    pen(near_pts, 'blue', 0.85, smooth=False, wobble=0.5, hook=0.3, twice=0.6)
    # a few contour strokes down the near slopes
    for (x0, y0, x1, y1) in [(150, 445, 230, 600), (330, 455, 300, 580), (520, 435, 600, 560), (700, 452, 760, 590),
                             (900, 490, 870, 600), (1200, 562, 1240, 620)]:
        pen([(x0, y0 + 6), ((x0 + x1) / 2 + 12, (y0 + y1) / 2), (x1, y1)], 'blue', 0.5, hook=0.4, gloop=0.2)
    b.stage('pen_near_mountains')
    pen([(-10, WL), (1930, WL)], 'blue', 0.75, smooth=False, bow=0.002, wobble=0.6, twice=0.4,
        clip=1 - smoothstep(0.1, 0.4, blur(pines_m, P(2))))
    b.stage('pen_waterline')
    for o in pine_geo:
        pen(o, 'black', 0.82, smooth=False, closed=True, wobble=0.5, hook=0.2)
    b.stage('pen_trees')
    # boat and rower
    pen(spline(hull + hull[:1], 6), 'black', 0.88, smooth=False, closed=True, twice=0.6)
    pen([(BX - BL / 2 + 6, BY - 18), (BX + BL / 2 - 2, BY - 22)], 'black', 0.7, hook=0.2)
    b.line(b.circle_pts(S(BX - 10), S(BY - 66), S(8.5), S(8.5)), 'black', 0.85, closed=True, hook=0.2)
    pen([(BX - 22, BY - 18), (BX - 24, BY - 42), (BX - 12, BY - 57), (BX, BY - 42), (BX - 2, BY - 18)], 'black', 0.85)
    pen([(BX - 4, BY - 44), (BX + 34, BY - 30), (BX + 78, BY + 6)], 'black', 0.85, hook=0.1)        # oar
    pen([(BX + 68, BY + 2), (BX + 86, BY + 10)], 'black', 0.95, width=P(5.0))
    b.stage('pen_boat')
    # birds: little gull "v"s
    for (bx, by, sz) in [(1380, 250, 20), (1450, 210, 16), (1530, 268, 22), (1610, 196, 14), (1680, 240, 18)]:
        w = sz * (1 + g.normal(0, 0.1))
        pen([(bx - w, by - w * 0.35), (bx - w * 0.45, by - w * 0.5), (bx, by), (bx + w * 0.5, by - w * 0.55),
             (bx + w * 1.05, by - w * 0.3)], 'black', 0.85, hook=0.2, gloop=0.2)
    b.stage('pen_birds')
    # ripple strokes on the water (left out round the boat)
    for k in range(34):
        y = WL + 18 + (k / 34) ** 1.4 * 420 + g.normal(0, 6)
        x = g.uniform(-40, 1880); L = g.uniform(40, 160) * (0.6 + (y - WL) / 440)
        pen([(x, y), (x + L * 0.5, y + g.normal(0, 1.2)), (x + L, y)], 'blue', 0.55 + 0.3 * (y - WL) / 440,
            hook=0.3, gloop=0.15, clip=excl)
    b.stage('pen_ripples')

    # ------------------------------------------------------------------ 2. coloured pencil
    # sky, cooler and darker up top, warm peach/rose low; glow behind the high peak left as paper + yellow
    glow = np.exp(-(((XX - S(1240)) / S(420)) ** 2 + ((YY - S(520)) / S(260)) ** 2))
    up = smoothstep(S(290), S(0), YY)
    hatch((sky_m > 0.5).astype(np.float32), 'violet', 62, 0.5, clip=up * (1 - glow * 0.8))
    hatch((sky_m > 0.5).astype(np.float32), 'blue', 58, 0.3, clip=smoothstep(S(220), S(0), YY))
    hatch((sky_m > 0.5).astype(np.float32), 'pink', 66, 0.42,
          clip=np.exp(-((YY - S(250)) / S(110)) ** 2) * (1 - glow * 0.5))
    hatch((sky_m > 0.5).astype(np.float32), 'peach', 56, 0.5, clip=smoothstep(S(200), S(380), YY) * keep)
    hatch((sky_m * smoothstep(0.15, 0.4, glow) > 0.4).astype(np.float32), 'yellow', 50, 0.6, clip=glow * keep)
    b.stage('pencil_sky')
    hatch(far_only, 'lilac', 64, 0.42, clip=keep * (1 - 0.3 * glow))
    hatch(far_only, 'pink', 40, 0.18, clip=keep)
    b.stage('pencil_far_mountains')
    near_shade = np.clip(near_m - pines_m, 0, 1)
    hatch(near_shade, 'teal', 58, 0.5, clip=keep)
    hatch(near_shade, 'violet', 118, 0.38, clip=keep * smoothstep(S(440), S(620), YY))
    # shadowed gullies: loose blotches of pen zigzag low on the slopes
    blot = noise2d(H, W, S(160), 3, seed + 7)
    sh = near_shade * smoothstep(0.58, 0.62, blot) * smoothstep(S(480), S(560), YY) * keep
    b.pen_hatch((sh > 0.5).astype(np.float32), 'blue', 52, spacing=P(4.6), pressure=0.35,
                length=(P(10), P(24)), overshoot=P(2.0), zigzag=0.7)
    b.stage('pencil_near_mountains')
    # water: horizontal strokes, darker toward the viewer; reflections in the colours above
    deep = smoothstep(wl, S(1080), YY)
    hatch(water_m, 'peach', 4, 0.42, clip=(1 - deep) * keep * excl, length=(70, 150))
    hatch(water_m, 'sky', 2, 0.42, clip=keep * excl, length=(70, 150))
    hatch(water_m, 'blue', -3, 0.45, clip=deep * excl, length=(70, 150))
    hatch(water_m, 'violet', 6, 0.35, clip=deep ** 1.5 * excl, length=(70, 150))
    hatch(far_ref, 'lilac', 2, 0.4, clip=keep * excl, length=(50, 120))
    hatch(near_ref, 'teal', -2, 0.55, clip=keep * excl, length=(50, 120))
    hatch(pref_m, 'leaf', 0, 0.55, clip=keep * excl, length=(30, 80))
    b.stage('pencil_water')
    hatch(pines_m, 'leaf', 70, 0.7, spacing=3.4, length=(14, 34), overshoot=2.5)
    hatch(pines_m, 'teal', 120, 0.45, spacing=3.6, length=(14, 30), overshoot=2.0)
    b.pen_hatch((pines_m * (XX < S(600)) * smoothstep(S(600), S(645), YY) > 0.5).astype(np.float32),
                'black', 45, spacing=P(4.0), pressure=0.35, length=(P(10), P(22)), zigzag=0.6)
    b.stage('pencil_trees')
    hatch(hull_m, 'brown', 50, 0.75, spacing=3.0, length=(14, 30), overshoot=2.0)
    hatch(fig_m, 'red', 60, 0.65, spacing=3.0, length=(10, 22), overshoot=1.5)
    hatch(hullr_m * water_m, 'brown', 2, 0.45, spacing=4.0, length=(20, 50), overshoot=3.0)
    b.lines([S.pts([(BX - 70 + k * 30 + g.normal(0, 4), BY + 22 + k % 2 * 8),
                    (BX - 40 + k * 30 + g.normal(0, 4), BY + 22 + k % 2 * 8)]) for k in range(5)],
            'black', 0.5, hook=0.2)
    b.stage('pencil_boat')
    # mist: the pencil was lifted there (paper shows); a few loose, light wavy pen strokes mark the drifting band
    for k in range(4):
        y = WL - 24 + k * 22 + g.normal(0, 4)
        x0 = g.uniform(-60, 120) + k * 60; x1 = x0 + g.uniform(700, 1000) * (1 - k * 0.15)
        n = 9
        xs_ = np.linspace(x0, x1, n)
        ys_ = y + np.sin(np.linspace(0, 3 * np.pi, n) + k) * 5
        pen(np.stack([xs_, ys_], 1), 'blue', 0.5 - k * 0.04, hook=0.4, gloop=0.0, skip=0.3,
            clip=1 - smoothstep(0.1, 0.4, blur(np.clip(pines_m + boat_m, 0, 1), P(2))))
    b.stage('mist')
    # foreground reeds, lower-left corner
    reeds = []
    for k in range(26):
        x = g.uniform(0, 300); y0 = 1090; h = g.uniform(100, 190) * (1 - x / 480)
        lean = g.normal(10, 10)
        reeds.append(S.pts([(x, y0), (x + lean * 0.4, y0 - h * 0.55), (x + lean, y0 - h)]))
    for R in reeds:
        b.pencil_line(R, 'ochre' if g.random() < 0.5 else 'leaf', 0.75, width=P(3.4))
    b.lines(reeds[::2], 'black', 0.65, hook=0.3, gloop=0.2)
    b.stage('reeds')

    img = b.composite()
    if stages_dir:
        os.makedirs(stages_dir, exist_ok=True)
        for i, (name, im) in enumerate(b.stages):
            save_png(im, os.path.join(stages_dir, f"{i:02d}_{name}.png"))
    return img


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else 'ballpoint_lake.png'
    W, H = (int(sys.argv[2]), int(sys.argv[3])) if len(sys.argv) > 3 else (1920, 1080)
    sd = os.environ.get('STAGES')
    save_png(paint(W, H, stages_dir=sd), out)
