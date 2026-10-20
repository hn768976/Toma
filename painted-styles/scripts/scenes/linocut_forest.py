"""Forest path — Linocut (黑白麻胶版画), vendor lib/linocut.py `Linocut`.
A path runs between tall black trunks toward a bright glade where a stag stands; sun rays are cut through the
dark canopy. Key block in black plus one spot-colour block: `Vermilion` (warm low sun in the glade, golden
rays) or `Indigo` (a cool morning: blue haze in the glade, blue rays). Full bleed.

python scripts/scenes/linocut_forest.py out.png [W H [colourway [bleed]]]
"""
import os
import sys

_HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(_HERE, '..'))
sys.path.insert(0, _HERE)
import numpy as np

import drawkit
from drawkit import Scaler, seed_all, save_png
from core import spline, fbm1d, noise2d
from linocut_common import STYLE, COLOURWAYS, make_print, D, Stager, gouge_rows, knife_edge, ridge_line

LIB = "linocut"
GROUPS = ("all",)

GL = (1060, 430, 600, 330)      # the glade's light: centre x, y, radii
SRC = (1090, 120)               # where the rays come from (above the frame's glade)
FLOOR = 618                     # the glade floor, far end of the path
DEER = (1068, 616)


def paint(W=1920, H=1080, seed=1, colourway="Vermilion", bleed=0.0, include=None, stages_dir=None,
          dense_stages=False):
    seed_all(seed)
    S = Scaler(W, H, bleed)
    d = D(S)
    L, col = make_print(S, seed, colourway)
    day = colourway == "Indigo"
    st = Stager(L, stages_dir, dense_stages)
    if include is not None and 'all' not in include:
        L.rng = drawkit.group_rng(seed, 'finish')
        img = L.pull().convert('RGB'); st.finish(img)
        return img
    CW, CH = S.W, S.H
    X0, X1, Y0, Y1 = S.X0 - 30, S.X1 + 30, S.Y0 - 30, S.Y1 + 30
    rng = drawkit.group_rng(seed, 'all')
    L.rng = drawkit.group_rng(seed, 'all#lib')
    P = S.pts
    rect = lambda x0, y0, x1, y1: P([(x0, y0), (x1, y0), (x1, y1), (x0, y1)])
    GX, GY, GRX, GRY = GL
    yy, xx = np.mgrid[0:CH, 0:CW].astype(np.float32)
    ux, uy = d.ux(xx), d.uy(yy)
    glow_d = lambda x, y: np.hypot((x - GX) / GRX, (y - GY) / GRY)          # 0 centre .. 1 rim (design)

    # ---------------------------------------------------------------- the woods behind, the glade of light
    # the dark woods everywhere get a sparse texture of upright cuts (light between far trunks), so the solid
    # black trunks in front read as shapes rather than as more black
    wall = rect(X0, Y0, X1, FLOOR + 30)
    geo = drawkit.group_rng(seed, 'geometry')
    trunk_sway = lambda x, y: 4 * np.sin(x / 37 + 1.3) + 3 * np.sin(y / 160 + x / 90)
    gouge_rows(L, S, rng, wall, (X0, Y0, X1, FLOOR + 30), angle=90, spacing=(9, 30), length=(30, 220), gap=(20, 140),
               width=(2.4, 4.6), cut=True, bend=trunk_sway, cluster=0.7, slip=0.04,
               density=lambda x, y: 0.2 + 0.2 * np.clip(1.6 - glow_d(x, y), 0, 1))
    st('woods')
    # the glade: carved with wide upright strokes, solid at the centre, feathering out into the dark
    gbox = P([(GX - GRX * 1.5, GY - GRY * 1.5), (GX + GRX * 1.5, GY - GRY * 1.5), (GX + GRX * 1.5, FLOOR + 24),
              (GX - GRX * 1.5, FLOOR + 24)])
    L.clear(L.poly(gbox) * (glow_d(ux, uy) < 0.4), chatter=0.25, angle=90)
    gb = (GX - GRX * 1.5, GY - GRY * 1.5, GX + GRX * 1.5, FLOOR + 24)
    gouge_rows(L, S, rng, gbox, gb, angle=90, spacing=(4.5, 8.5), length=(80, 360), gap=(3, 22), width=(6, 10.5), cut=True,
               bend=trunk_sway, cluster=0.5, density=lambda x, y: np.clip(1.45 - 1.2 * glow_d(x, y), 0, 1) ** 1.3)
    st('glade cleared')
    # the colour: a ring of it round the light, printed where the key is carved; the centre stays paper-white
    L.leave(L.poly(gbox) * (glow_d(ux, uy) < 1.3), on=col)
    rag = (noise2d(CH, CW, S(60), 3, seed + 77) - 0.5) * 0.16          # a ragged, hand-cleared edge
    L.clear(L.poly(gbox) * (glow_d(ux, uy) + rag < 0.2), on=col, chatter=0)
    gouge_rows(L, S, rng, gbox, gb, angle=0, spacing=(4, 9), length=(40, 260), gap=(4, 26), width=(5.5, 9.5), cut=True, on=col,
               bend=lambda x, y: 10 * ((x - GX) / 700) ** 2 + 3 * np.sin(x / 90 + y / 40),
               density=lambda x, y: np.clip(max(1.5 - glow_d(x, y) * 1.6, (glow_d(x, y) - 0.95) * 2.8), 0, 1) ** 0.7)
    st('glade colour')

    # far trunks in the haze: thin, sparse, ridges left standing; nearer ones a little thicker
    far = []
    for k in range(3):
        n = (14, 10, 7)[k]
        for x in np.linspace(GX - GRX * 1.05, GX + GRX * 1.05, n):
            x = x + rng.uniform(-30, 30)
            if abs(x - GX) < 50 + 25 * k: continue
            far.append((x, k))
    for (x, k) in sorted(far, key=lambda t: t[1]):
        w = (3.0, 5.5, 9.0)[k] * rng.uniform(0.8, 1.2)
        yb = FLOOR - 6 + k * 14 + rng.uniform(-4, 4)
        lean = rng.uniform(-6, 6)
        L.gouge(P([(x + lean, Y0 - 20), (x + lean * 0.5, (Y0 + yb) / 2), (x, yb)]), S(w), 'brush', end=S(w * 1.25),
                cut=False, smooth=True, jitter=0.08)
        if k == 2:                                   # a few branches
            for _ in range(2):
                by = rng.uniform(GY - GRY * 0.6, FLOOR - 120); s = rng.choice([-1, 1])
                L.gouge(P([(x, by), (x + s * 30, by - 26), (x + s * 58, by - 30)]), S(w * 0.45), 'brush', end=S(1.0),
                        cut=False)
    st('far trunks')
    # the glade floor: low ridges left standing across the light
    gouge_rows(L, S, rng, P([(GX - GRX * 1.2, FLOOR - 26), (GX + GRX * 1.2, FLOOR - 26), (GX + GRX * 1.2, FLOOR + 60),
                             (GX - GRX * 1.2, FLOOR + 60)]), (GX - GRX * 1.2, FLOOR - 26, GX + GRX * 1.2, FLOOR + 60),
               spacing=(6, 13), length=(16, 110), gap=(10, 70), width=(2.6, 4.0), cut=False, tool='brush', end=0.45,
               bend=lambda x, y: 2 * np.sin(x / 60), density=lambda x, y: np.clip(0.15 + (y - FLOOR + 20) / 70, 0, 0.8))
    st('glade floor')

    # ---------------------------------------------------------------- the forest floor and the path
    left = [(520, Y1 + 10), (600, 1010), (760, 900), (900, 800), (985, 718), (1022, 660), (1040, FLOOR)]
    right = [(1098, FLOOR), (1118, 660), (1170, 718), (1255, 800), (1345, 900), (1440, 1010), (1500, Y1 + 10)]
    LP, RP = spline(left, 10), spline(right, 10)
    path = P(LP.tolist() + RP.tolist())
    pm = L.poly(path)
    # grass and leaf litter on the dark floor: short upright V cuts, denser near the path and the light
    floor = rect(X0, FLOOR - 10, X1, Y1)
    pl = lambda y: np.interp(y, LP[::-1, 1], LP[::-1, 0])
    pr = lambda y: np.interp(y, RP[:, 1], RP[:, 0])

    def near_path(x, y):
        dd = min(abs(x - pl(y)), abs(x - pr(y)))
        return np.exp(-dd / 160)
    # tufts: clustered fans of short V cuts, never a grid
    fden = lambda x, y: np.clip(0.08 + 0.55 * near_path(x, y) * (1.25 - (y - FLOOR) / 600)
                                + 0.4 * np.clip(1.25 - glow_d(x, y), 0, 1), 0, 0.85)
    tufts = []
    for _ in range(int(1800 * (X1 - X0) / 1980)):
        x = rng.uniform(X0, X1); y = rng.uniform(FLOOR - 10, Y1)
        if rng.random() > fden(x, y): continue
        k = 0.6 + 0.9 * (y - FLOOR) / (1080 - FLOOR)
        lean0 = rng.normal(0, 0.3)
        for _ in range(int(rng.integers(1, 5))):
            a = lean0 + rng.normal(0, 0.35); h = rng.uniform(7, 20) * k
            xb = x + rng.uniform(-5, 5) * k
            tufts.append(L.stroke(P([(xb, y), (xb + np.sin(a) * h, y - np.cos(a) * h)]), S(rng.uniform(2.2, 3.4) * k), 'v',
                                  taper=(0.05, rng.uniform(0.4, 0.7))))
    L._draw(tufts, True, None, floor)
    st('forest floor')
    L.clear(pm, chatter=0.45, angle=90)
    L.outline(pm, S(2.2), cut=False)
    # ruts and stones: ridges left standing along the path, converging on the glade
    for f in (0.22, 0.32, 0.68, 0.78):
        pts = [((1 - f) * pl(y) + f * pr(y) + rng.uniform(-6, 6), y) for y in np.linspace(Y1, FLOOR + 6, 14)]
        segs = np.linspace(0, len(pts) - 1, 5).astype(int)
        for a, b in zip(segs[:-1], segs[1:]):
            if rng.random() < 0.8:
                L.gouge(P(pts[a:b + 1]), S(2.6), 'v', cut=False, region=pm)
    for _ in range(16):
        y = FLOOR + 30 + (Y1 - FLOOR - 30) * rng.random() ** 0.7
        x = pl(y) + (pr(y) - pl(y)) * rng.uniform(0.05, 0.95)
        s = 2 + 0.012 * (y - FLOOR)
        L.gouge(P([(x - s * 3, y), (x + s * 3, y + rng.uniform(-1, 1))]), S(s * 0.9), 'v', cut=False, region=pm)
    st('path')
    # the colour on the path: warm (or cool) light pooled on it, broken by ridges
    gouge_rows(L, S, rng, path, (500, FLOOR, 1520, Y1), spacing=(6, 13), length=(20, 140), gap=(8, 50), width=(4.5, 8.5),
               cut=False, on=col, tool='brush', end=0.5, bend=lambda x, y: 4 * np.sin(x / 70 + y / 30),
               density=lambda x, y: np.clip((0.95 if day else 0.75) - (y - FLOOR) / 650, 0.08, 0.8))
    st('path colour')

    # ---------------------------------------------------------------- middle-distance trunks
    mid = [(560, 34, -0.02), (720, 22, 0.01), (870, 14, 0.0), (1250, 16, 0.01), (1370, 26, -0.01), (1500, 38, 0.02)]
    for (x, w, lean) in mid:
        yb = FLOOR + 40 + w * 2.2
        top = Y0 - 30 - w * 3
        pts = [(x + lean * (yb - top), top), (x + lean * (yb - top) * 0.5, (top + yb) / 2), (x, yb)]
        tm = L.mask_of([L.stroke(P(pts), S(w), 'brush', end=S(w * 1.15), jitter=0.04),
                        np.array(P([(x - w * 1.0, yb + 4), (x - w * 0.5, yb - w * 1.4), (x + w * 0.5, yb - w * 1.4),
                                    (x + w * 1.0, yb + 4)]), np.float32)])
        L.outline(tm * (uy < FLOOR + 6), S(2.8))      # no halo where the foot meets the dark floor
        L.leave(tm)
        L.clear(tm, on=col, chatter=0)
        # bark: vertical cuts on the side that faces the glade
        side = 1 if x < GX else -1
        for _ in range(int(w / 3)):
            f = rng.uniform(0.05, 0.42)
            bx_ = x + side * w * f
            y0 = rng.uniform(Y0 - 30, yb - 120); ln = rng.uniform(50, 240)
            L.gouge(P([(bx_ + lean * (yb - y0), y0), (bx_ + lean * (yb - y0 - ln / 2) + rng.normal(0, 1.5), y0 + ln / 2),
                       (bx_ + lean * (yb - y0 - ln) + rng.normal(0, 2), y0 + ln)]), S(rng.uniform(2.2, 3.4)), 'v',
                    region=tm)
        st('trunk')

    # ---------------------------------------------------------------- sun rays through the canopy
    # parallel shafts slanting down to the left, each a band of fine broken cuts; they only show where the
    # woods are dark, and leave a pool of light where they reach the floor
    a = np.radians(116)
    dv = np.array([np.cos(a), np.sin(a)]); nv = np.array([-dv[1], dv[0]])
    for (xt, wd, yend) in [(640, 46, 760), (930, 34, 700), (1330, 52, 690), (1560, 40, 760), (1760, 30, 860)]:
        p_top = np.array([xt, Y0 - 20], np.float64)
        a_r = np.radians(116 + rng.normal(0, 1.8) + (xt - SRC[0]) * 0.003)       # the shafts fan a little
        dvr = np.array([np.cos(a_r), np.sin(a_r)]); nvr = np.array([-dvr[1], dvr[0]])
        t_end = (yend - p_top[1]) / dvr[1]
        nl = int(wd / rng.uniform(8, 12)) + 2
        offs = np.sort(rng.uniform(-wd / 2, wd / 2, nl))
        for j, off in enumerate(offs):
            prof = np.cos(np.pi * off / wd) ** 0.7
            t = rng.uniform(0, 90)
            while t < t_end:
                ln = rng.uniform(60, 360)
                tt = np.linspace(t, min(t + ln, t_end), 7)
                sway = rng.normal(0, 1.6) * np.sin(np.pi * np.linspace(0, 1, 7))
                pts = [tuple(p_top + dvr * q + nvr * (off + o)) for q, o in zip(tt, sway)]
                fade = 0.4 + 0.6 * min(1.0, t / 300)
                if rng.random() < 0.85:
                    L.gouge(P(pts), S((2.0 + 2.6 * prof) * fade * rng.uniform(0.75, 1.25)), 'v',
                            taper=(rng.uniform(0.1, 0.35), rng.uniform(0.15, 0.45)), smooth=True)
                t += ln + rng.uniform(14, 110)
        # the pool of light on the floor
        pe = p_top + dvr * t_end
        for _ in range(int(wd * 0.5)):
            x = pe[0] + rng.normal(0, wd * 1.4); y = pe[1] + rng.normal(0, wd * 0.35); h_ = rng.uniform(6, 16)
            L.gouge(P([(x - h_, y), (x + rng.uniform(-2, 2), y - rng.uniform(0, 2)), (x + h_, y + rng.uniform(-1, 1))]),
                    S(rng.uniform(2.4, 4.2)), 'v')
    st('rays')

    # canopy: leaf nicks cut in the dark crown, thick toward the light
    L.flow(rect(X0, Y0, X1, 330), lambda x, y: 70 + 30 * np.sin(x / S(90)), n=int(320 * (X1 - X0) / 1980),
           length=(S(8), S(22)), width=(S(2.6), S(5.0)), tool='v', cut=True, step=S(2.0),
           density=d.fn(lambda x, y: np.clip(1.2 - np.hypot((x - GX) / 700, (y - 150) / 220), 0, 1) ** 1.8))
    st('canopy')

    # ---------------------------------------------------------------- the stag in the glade
    DX, DY = DEER
    def dp(pts): return np.array(P(knife_edge([(DX + x, DY + y) for x, y in pts], geo, step=(3, 7), wob=0.45, nick=0.04,
                                              nick_size=(0.8, 1.6))), np.float32)
    body = [(18 + 26 * np.cos(t), -38 + 11 * np.sin(t)) for t in np.linspace(0, 2 * np.pi, 28, endpoint=False)]
    parts = [dp(body),
             dp([(-4, -44), (-14, -64), (-20, -76), (-12, -78), (-2, -62), (8, -46), (6, -32)]),       # neck
             dp([(-20, -80), (-12, -82), (-8, -76), (-14, -70), (-26, -68), (-31, -70), (-29, -74)]),   # head
             dp([(-12, -80), (-8, -88), (-6, -80)]), dp([(-15, -80), (-20, -87), (-17, -79)])]          # ears
    for (x0, x1) in ((-2, -6), (6, 4), (34, 32), (40, 44)):                                         # legs
        parts.append(L.stroke(P([(DX + x0, DY - 32), (DX + (x0 + x1) / 2 + 1, DY - 16), (DX + x1, DY)]), S(3.6), 'brush',
                              end=S(1.8), jitter=0.04))
    parts.append(L.stroke(P([(DX + 43, DY - 44), (DX + 47, DY - 40)]), S(3.0), 'brush', end=S(1.4)))           # tail
    for s in (-1, 1):                                                                                        # antlers
        bx, by = DX - 12 + s * 2, DY - 84
        main = [(bx, by), (bx + s * 8, by - 12), (bx + s * 6, by - 26), (bx + s * 12, by - 36)]
        parts.append(L.stroke(P(spline(main, 6)), S(2.2), 'brush', end=S(1.0), jitter=0.04))
        for (t0, dx_, dy_) in ((0.3, -s * 8, -8), (0.6, s * 10, -8), (0.85, -s * 6, -9)):
            q = spline(main, 6)[int(t0 * (len(spline(main, 6)) - 1))]
            parts.append(L.stroke(P([(q[0], q[1]), (q[0] + dx_, q[1] + dy_)]), S(1.6), 'brush', end=S(0.8), jitter=0.04))
    dm = L.mask_of(parts)
    L.outline(dm, S(3.0))
    L.leave(dm)
    L.clear(dm, on=col, chatter=0)
    L.gouge(P([(DX - 22, DY - 73), (DX - 20, DY - 73)]), S(1.4), 'u')                                        # eye glint
    # its shadow on the glade floor
    L.gouge(P([(DX - 10, DY + 2), (DX + 20, DY + 3), (DX + 56, DY + 2)]), S(3.0), 'brush', end=S(1.2), cut=False)
    st('stag')

    # ---------------------------------------------------------------- foreground trunks, roots and ferns
    fg = [(110, 150, 0.015), (395, 78, -0.01), (1610, 104, 0.012), (1850, 168, -0.012)]
    if S.X0 < -60: fg = [(-170, 120, 0.0)] + fg
    if S.X1 > 1980: fg = fg + [(2090, 110, 0.0)]
    for (x, w, lean) in fg:
        yb = Y1 + 20
        top = Y0 - 30 - w * 3
        pts = [(x + lean * (yb - top), top), (x, yb)]
        roots = []
        for s in (-1, 1):
            roots.append(L.stroke(P(spline([(x + s * w * 0.3, 900 + w * 0.2), (x + s * w * 0.62, 1000), (x + s * w * 1.05, Y1 + 30)], 8)),
                                  S(w * 0.55), 'brush', end=S(w * 0.3), jitter=0.04))
        tm = L.mask_of([L.stroke(P(pts), S(w), 'brush', end=S(w * 1.08), jitter=0.03)] + roots)
        L.outline(tm, S(3.5))
        L.leave(tm)
        L.clear(tm, on=col, chatter=0)
        # bark: long vertical cuts, close together on the lit side, sparse in the shade
        side = 1 if x < GX else -1
        for _ in range(int(w * 0.7)):
            f = side * rng.uniform(0.12, 0.47)
            lit = float(np.clip((side * f - 0.1) / 0.37, 0, 1))
            if rng.random() > 0.1 + 0.9 * lit ** 2: continue
            y0 = rng.uniform(Y0 - 30, yb - 80); ln = rng.uniform(40, 260)
            bx_ = x + f * w
            L.gouge(P([(bx_ + lean * (yb - y0), y0), (bx_ + rng.normal(0, 2.5) + lean * (yb - y0 - ln / 2), y0 + ln / 2),
                       (bx_ + rng.uniform(-4, 4) + lean * (yb - y0 - ln), y0 + ln)]),
                    S(rng.uniform(2.2, 4.0) * (0.6 + 0.6 * lit)), 'v', region=tm, taper=(rng.uniform(0.05, 0.4), rng.uniform(0.1, 0.5)))
        # a knot or a broken branch stub
        ky = rng.uniform(250, 650); kl = rng.uniform(20, 46); kw = rng.uniform(10, 17)
        L.gouge(P([(x + side * w * 0.5, ky), (x + side * (w * 0.5 + kl * 0.5), ky - kl * rng.uniform(0.2, 0.5)),
                   (x + side * (w * 0.5 + kl), ky - kl * rng.uniform(0.4, 0.9))]), S(kw), 'brush', end=S(kw * rng.uniform(0.45, 0.7)),
                cut=False)
        st('big trunk')
    # ferns: fronds of white leaflets cut out of the dark floor in the front corners
    def fern(x, y, ln, ang, s):
        a = np.radians(ang + rng.normal(0, 5))
        ln = ln * rng.uniform(0.85, 1.15)
        n = int(rng.integers(10, 17)); curl = rng.uniform(0.1, 0.28); lf = rng.uniform(0.16, 0.25)
        spine = [(x + np.cos(a) * ln * t + s * curl * ln * t * t * np.cos(a + np.pi / 2),
                  y + np.sin(a) * ln * t + s * curl * ln * t * t * np.sin(a + np.pi / 2)) for t in np.linspace(0, 1, n)]
        L.gouge(P(spine), S(2.6), 'v', taper=(0.05, 0.4))
        for i in range(1, n - 1):
            px, py = spine[i]
            qx, qy = spine[i + 1]
            tx, ty = (qx - px), (qy - py)
            nrm = np.hypot(tx, ty) + 1e-6
            nx, ny = -ty / nrm, tx / nrm
            for sd in (-1, 1):
                if rng.random() < 0.08: continue                     # a leaflet broken off
                ll = (ln * lf * (1 - i / n) ** 0.7 + 4) * rng.uniform(0.75, 1.2)
                L.gouge(P([(px, py), (px + nx * sd * ll * 0.6 + tx * 0.6, py + ny * sd * ll * 0.6 + ty * 0.6),
                           (px + nx * sd * ll + tx * 1.2, py + ny * sd * ll + ty * 1.2)]), S(4.2 * (1 - i / n) + 1.6), 'v',
                        taper=(0.15, 0.5))
    for (x, y, ln, ang, s) in [(230, 1090, 230, -120, 1), (250, 1090, 200, -70, -1), (210, 1095, 170, -150, 1),
                               (1700, 1095, 220, -60, -1), (1720, 1095, 190, -110, 1), (1760, 1095, 160, -30, -1)]:
        fern(x, y, ln, ang, s)
    st('ferns')

    L.rng = drawkit.group_rng(seed, 'finish')
    img = L.pull().convert('RGB')
    st.finish(img)
    return img


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else 'linocut_forest.png'
    W = int(sys.argv[2]) if len(sys.argv) > 2 else 1920
    H = int(sys.argv[3]) if len(sys.argv) > 3 else 1080
    cw = sys.argv[4] if len(sys.argv) > 4 else 'Vermilion'
    b = float(sys.argv[5]) if len(sys.argv) > 5 else 0.0
    save_png(paint(W, H, colourway=cw, bleed=b), out)
    print('saved', out)
