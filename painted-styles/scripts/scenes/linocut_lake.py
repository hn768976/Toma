"""Mountain lake at dusk — Linocut (黑白麻胶版画), vendor lib/linocut.py `Linocut`.
Key block in black plus one spot-colour block: `Vermilion` (Phase 1: dusk afterglow and its reflection) or
`Indigo` (a cooler daytime print: blue sky streaks, a blue-tinted far range and blue water).
Full-bleed: the block is larger than the sheet, so no paper margin, rim, pencil or chop.

python scripts/scenes/linocut_lake.py out.png [W H [colourway [bleed]]]
"""
import os
import sys

_HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(_HERE, '..'))
sys.path.insert(0, _HERE)
import numpy as np

import drawkit
from drawkit import Scaler, seed_all, save_png
from core import spline, fbm1d
from linocut_common import (STYLE, COLOURWAYS, make_print, D, Stager, day_sky, day_cloud, gouge_rows, knife_edge,
                            ridge_line, carved_reflection, pine, bird, scallop_band)

LIB = "linocut"
GROUPS = ("sky", "clouds", "far", "near", "water", "mist", "boat", "birds", "reeds")

HOR = 640
GLOW = (1240, 560)


def paint(W=1920, H=1080, seed=1, colourway="Vermilion", bleed=0.0, include=None, stages_dir=None,
          dense_stages=False):
    seed_all(seed)
    S = Scaler(W, H, bleed)
    d = D(S)
    inc = set(GROUPS) if include is None else set(include)
    L, col = make_print(S, seed, colourway)
    day = colourway == "Indigo"
    st = Stager(L, stages_dir, dense_stages)
    CW, CH = S.W, S.H
    hz = int(round(S.y(HOR)))
    hor = S.y(HOR)
    X0, X1, Y0, Y1 = S.X0 - 30, S.X1 + 30, S.Y0 - 30, S.Y1 + 30      # design range + a margin
    GX, GY = GLOW

    def group(name):
        L.rng = drawkit.group_rng(seed, name + '#lib')
        return drawkit.group_rng(seed, name)

    # ---- geometry (design space, independent of any painting)
    geo = drawkit.group_rng(seed, 'geometry')             # knife facets of the silhouettes: fixed per print

    def ridge(xs_ctrl, ys_ctrl, wob, nick):
        P = spline(list(zip(xs_ctrl, ys_ctrl)), 16)
        xs = np.arange(S.x(X0), S.x(X1) + 1, max(2.0, S(4)), dtype=np.float32)
        smooth = (xs, np.interp(xs, S.x(P[:, 0]), S.y(P[:, 1])).astype(np.float32))
        K = np.array(knife_edge(P[(P[:, 0] > X0 - 60) & (P[:, 0] < X1 + 60)], geo, step=(10, 36), wob=wob, nick=nick,
                                nick_size=(2.5, 7), closed=False, side=1))
        return smooth, (S.x(K[:, 0]), S.y(K[:, 1]))

    fx = np.linspace(-640, 2560, 98)
    fr = fbm1d(98, 8, 3, seed + 11)
    fy = (392 - 80 * np.exp(-((fx - 1250) / 130) ** 2) - 30 * np.exp(-((fx - 1400) / 80) ** 2)
          - 48 * np.exp(-((fx - 560) / 200) ** 2) - 22 * np.exp(-((fx - 1760) / 130) ** 2)
          + 22 * np.exp(-((fx - 900) / 110) ** 2) + 12 * fr)
    (FX, FY), (FKX, FKY) = ridge(fx, fy, 1.2, 0.05)
    nx = np.linspace(-640, 2560, 65)
    ny = (600 - 150 * np.exp(-((nx - 320) / 330) ** 2) - 80 * np.exp(-((nx - 820) / 200) ** 2)
          - 50 * np.exp(-((nx - 1700) / 190) ** 2) + 8 * fbm1d(65, 6, 3, seed + 21))
    (NX, NY), (NKX, NKY) = ridge(nx, ny, 1.6, 0.1)
    far_r = lambda x: np.interp(x, FX, FY)          # canvas px
    near_r = lambda x: np.interp(x, NX, NY)
    far_d = lambda x: d.uy(far_r(S.x(x)))           # design
    near_d = lambda x: d.uy(near_r(S.x(x)))
    top = [(S.x(X0), S.y(Y0)), (S.x(X1), S.y(Y0))]
    sky_poly = top + list(zip(FKX[::-1], FKY[::-1]))
    far_poly = list(zip(FKX, FKY)) + [(S.x(X1), hor + S(2)), (S.x(X0), hor + S(2))]
    near_poly = list(zip(NKX, NKY)) + [(S.x(X1), hor + S(2)), (S.x(X0), hor + S(2))]
    water_poly = [(S.x(X0), hor), (S.x(X1), hor), (S.x(X1), S.y(Y1)), (S.x(X0), S.y(Y1))]
    band = lambda y0, y1: [(S.x(X0), S.y(y0)), (S.x(X1), S.y(y0)), (S.x(X1), S.y(y1)), (S.x(X0), S.y(y1))]
    gd = lambda x, y: float(np.hypot((y - GY) * 1.6, x - GX))      # design px from the hidden sun
    # sky gouges arc over the afterglow (rows sag away from it toward the edges) and swell gently
    sky_bend = lambda x, y: (58 * np.clip((GY - y) / 450, 0, 1.3) * ((x - GX) / 1000) ** 2
                             + 9 * np.sin(x / 380 + y / 150) + 4 * np.sin(x / 170 - y / 60))

    # ======================================================================= groups
    def g_sky(stage=True):
        rng = group('sky')
        stg = st if stage else (lambda *a, **k: None)
        if day:
            day_sky(L, col, S, d, rng, sky_poly, (X0, Y0 - 40, X1, HOR + 10), 40, HOR - 120,
                    bands=((Y0 - 40, 250), (250, HOR + 10)), stg=stg, bend=sky_bend)
            stg('sky', major=True)
            return
        L.clear(L.poly(band(400, HOR)), chatter=0.35, angle=2)
        stg('sky low cleared')
        # V-gouge streaks: few, bold, arcing over the glow, carved more and wider toward the horizon
        skyd = lambda x, y: np.clip((y - 105) / 300, 0.0, 1) ** 1.25
        for (a, b) in ((Y0 - 40, 230), (230, 330), (330, 430)):
            gouge_rows(L, S, rng, band(40, 430), (X0, 40, X1, 430), spacing=(12, 25), length=(60, 380), gap=(10, 110),
                       width=(3.8, 8.5), cut=True, bend=sky_bend, slip=0.05,
                       density=lambda x, y, a=a, b=b: skyd(x, y) * (a <= y < b))
            stg('sky cuts')
        # spot colour streaks left standing on the colour block; they show only through the carved key
        dens = lambda x, y: np.clip(1.15 - gd(x, y) / 900, 0.05, 1) * (y > 150)
        for (a, b) in ((Y0 - 40, 360), (360, HOR + 10)):
            gouge_rows(L, S, rng, sky_poly, (X0, Y0 - 40, X1, HOR + 10), spacing=(5, 11), length=(40, 300), gap=(4, 40),
                       width=(5, 10), cut=False, on=col, bend=sky_bend, tool='brush', end=0.55,
                       density=lambda x, y, a=a, b=b: dens(x, y) * (a <= y < b))
            stg('sky colour')
        stg('sky', major=True)

    def g_clouds():
        rng = group('clouds')
        # thin lens-shaped clouds high in the black: stacks of long V cuts tapering at both ends,
        # with a lit underside left standing on the colour block
        clouds = [(330, 118, 520, 1.0), (930, 92, 420, 0.8), (1470, 140, 600, 1.0), (1830, 78, 360, 0.7)]
        if S.X0 < -60: clouds.append((-120, 150, 380, 0.75))
        if S.X1 > 1980: clouds.append((2040, 172, 300, 0.6))
        for (cx, cy, ln, k) in clouds:
            if day:
                day_cloud(L, col, S, rng, cx, cy, ln, k)
                st('cloud')
                continue
            rows = 3 + int(rng.integers(0, 2) + 3 * k)
            ys = np.cumsum(rng.uniform(0.6, 1.4, rows)); ys = (ys - ys[0]) / max(ys[-1] - ys[0], 1e-6)
            sag = rng.uniform(-2.0, 3.0)
            for i in range(rows):
                f = ys[i]                                     # 0 top .. 1 underside, irregular steps
                half = ln / 2 * (0.35 + 0.65 * np.sin(np.pi * (0.15 + 0.7 * f))) * rng.uniform(0.8, 1.15)
                y = cy + (f - 0.5) * 46 * k
                x0 = cx - half + rng.uniform(-30, 30) + 40 * (1 - f)
                x1 = cx + half + rng.uniform(-30, 30) - 20 * (1 - f)
                n = 1 if half < 140 or rng.random() < 0.3 else 2
                xs = np.linspace(x0, x1, n + 1)
                for j in range(n):
                    a, b = xs[j] + rng.uniform(0, 18), xs[j + 1] - rng.uniform(0, 18)
                    m = (a + b) / 2 + rng.uniform(-30, 30)
                    pts = [(a, y + 1.5), (m, y - (1.8 + sag) * k + rng.uniform(-1, 1)), (b, y + rng.uniform(-1, 2.5))]
                    w = ((2.2 + 2.6 * f) * k + 0.8) * rng.uniform(0.8, 1.25)
                    L.gouge(S.pts(pts), S(w), 'v', cut=True, taper=(rng.uniform(0.15, 0.45), rng.uniform(0.15, 0.45)))
                    if f > 0.6:                                 # lit underside on the colour block
                        L.gouge(S.pts([(a + 10, y + 2), (m, y + 0.5), (b - 10, y + 2)]), S(w + 2.5), 'v', cut=False, on=col,
                                taper=(0.35, 0.35))
            st('cloud')
        st('clouds', major=True)

    def g_far(stage=True):
        rng = group('far')
        stg = st if stage else (lambda *a, **k: None)
        L.clear(L.poly(far_poly), chatter=0.3, angle=0)
        stg('far cleared')
        ridge_line(L, S, rng, list(zip(d.ux(FKX), d.uy(FKY))), 2.8, breaks=0.12, seg=(30, 120), smooth=False)
        stg('far contour')
        fbend = lambda x, y: (far_d(x) - far_d(1000)) * np.clip(1.15 - (y - far_d(x)) / 260, 0.35, 1)
        for (a, b) in ((X0, 960), (960, X1)):
            gouge_rows(L, S, rng, far_poly, (X0, 200, X1, HOR), spacing=(10, 24), length=(16, 120), gap=(14, 90),
                       width=(2.6, 4.2), cut=False, bend=fbend, tool='brush', end=0.5,
                       density=lambda x, y, a=a, b=b: (a <= x < b) * np.clip(
                           0.08 + 0.4 * np.exp(-(y - far_d(x)) / 32) + 0.22 * (x < GX - 300), 0, 0.65))
            stg('far ridges')
        if day:   # the far range prints pale blue: a tint left standing on the colour block, broken by ridge cuts
            fm = L.poly(far_poly) * (np.arange(CH)[:, None] < hor - S(2))
            L.leave(fm, on=col)
            gouge_rows(L, S, rng, far_poly, (X0, 200, X1, HOR), spacing=(6, 14), length=(30, 180), gap=(10, 60),
                       width=(3.2, 6), cut=True, on=col, bend=fbend,
                       density=lambda x, y: np.clip(0.2 + (y - far_d(x)) / 160, 0, 1))
            stg('far tint')
        stg('far', major=True)

    def pines_right():
        return [(1505, 540), (1560, 500), (1618, 552), (1668, 512), (1730, 545), (1790, 520), (1850, 560)]

    def g_near(stage=True):
        rng = group('near')
        stg = st if stage else (lambda *a, **k: None)
        L.outline(L.poly(near_poly), S(2.8))
        L.leave(L.poly(near_poly))
        stg('near block')
        quiet = lambda x, y: 1 - 0.65 * np.exp(-((x - 1680) / 230) ** 2) * (y > 520)   # calm behind the right pines
        nbend = lambda x, y: (near_d(x) - near_d(600)) * np.clip(1.1 - (y - near_d(x)) / 200, 0.3, 1)
        for (a, b) in ((X0, 800), (800, X1)):
            gouge_rows(L, S, rng, near_poly, (X0, 400, X1, HOR), spacing=(10, 22), length=(20, 150), gap=(10, 90),
                       width=(2.8, 5.0), cut=True, bend=nbend, slip=0.05,
                       density=lambda x, y, a=a, b=b: (a <= x < b) * quiet(x, y) * np.clip(
                           0.32 + 0.42 * np.exp(-(y - near_d(x)) / 50) + 0.22 * (x > 700), 0, 0.9))
            stg('near cuts')
        # pines on both shores (standing black spruces, white halo where they cross the black hill); every one
        # its own lean, tiers and lopsidedness
        left = [(75, 470), (130, 430), (190, 500), (245, 420), (300, 475), (355, 520), (400, 455),
                (455, 540), (505, 560), (165, 545), (275, 555), (425, 585)]
        if S.X0 < -40:
            left = [(-30, 455), (10, 500)] + left
        for i, (x, ty) in enumerate(sorted(left, key=lambda t: t[1])):
            pine(L, S, rng, x + rng.normal(0, 4), 652, 652 - ty + rng.normal(0, 6), halo=2.6, nicks=0.35)
            if i % 2 == 1: stg('pine')
        # right shore: tall, their tips against the pale far range, a wider halo
        for i, (x, ty) in enumerate(pines_right()):
            pine(L, S, rng, x + rng.normal(0, 3), 652, 652 - ty + rng.normal(0, 6), w=(652 - ty) * 0.42, halo=4.5,
                 nicks=0.2)
            if i % 2 == 1: stg('pine')
        stg('near', major=True)

    def g_water():
        rng = group('water')
        # reflections come from the sky, far and near carvings: re-carve them on a scratch copy of the blocks,
        # so this group never depends on which other groups were printed
        saved = [b.a.copy() for b in L.blocks]; ch = L.chatter.copy()
        L.key.a[:] = L._outer
        for b in L.blocks:
            if b is not L.key: b.a[:] = 0
        g_sky(False); g_far(False); g_near(False)
        key1 = (np.asarray(L.key.a, np.float32)[::L.ss, ::L.ss] / 255)[:CH, :CW]
        colm = (np.asarray(col.a, np.float32)[::L.ss, ::L.ss] / 255)[:CH, :CW]
        for b, a in zip(L.blocks, saved): b.a[:] = a
        L.chatter[:] = ch
        rng = group('water')

        L.clear(L.poly(water_poly), chatter=0.45, angle=0)
        L.clear(L.poly(water_poly), on=col, chatter=0)
        st('water cleared')
        # the reflection carved as broken horizontal strokes, squashed and breaking up with depth
        carved_reflection(L, S, rng, key1, HOR + 3, 330, squash=0.78, rows=(3.4, 6.0), dash=(24, 150), gap=(1.5, 10),
                          keep0=1.0, keep1=0.3, sway=(2.0, 0.8), region=water_poly)
        st('reflection')
        # swells: broken ridges left standing, sparse near the shore, bolder and closer toward us
        wbend = lambda x, y: 3 * np.sin(x / 150 + y / 31) + 2 * np.sin(x / 61 - y / 17)
        for (a, b) in ((HOR, 790), (790, 940), (940, Y1 + 40)):
            gouge_rows(L, S, rng, water_poly, (X0, HOR, X1, Y1), spacing=(8, 20), length=(24, 240), gap=(10, 110),
                       width=(2.6, 4.8), cut=False, bend=wbend, tool='brush', end=0.45, cluster=0.6,
                       density=lambda x, y, a=a, b=b: (a <= y < b) * np.clip(
                           0.1 + 0.85 * max(0.0, (y - HOR) / (1080 - HOR)) ** 1.4, 0, 0.9))
            st('ripple ridges')
        if day:
            # blue water: the far range's tint carved as broken blue strokes, then long blue swells
            rc = colm * (key1 < 0.5)
            carved_reflection(L, S, rng, rc, HOR + 3, 300, squash=0.78, rows=(4, 8), dash=(20, 140), gap=(3, 20),
                              keep0=0.9, keep1=0.3, on=col, region=water_poly)
            gouge_rows(L, S, rng, water_poly, (X0, HOR, X1, Y1), spacing=(6, 14), length=(30, 260), gap=(8, 70),
                       width=(4.5, 8), cut=False, on=col, bend=wbend, tool='brush', end=0.5,
                       density=lambda x, y: np.clip(0.15 + 0.75 * max(0.0, (y - HOR) / 440) ** 0.8, 0, 0.9))
        else:
            # the afterglow's reflection: short streaks under the hidden sun, broken and swaying
            gouge_rows(L, S, rng, [(S.x(GX - 460), hor + S(4)), (S.x(GX + 460), hor + S(4)), (S.x(GX + 460), S.y(1010)),
                                   (S.x(GX - 460), S.y(1010))], (GX - 460, HOR, GX + 460, 1010),
                       spacing=(5, 11), length=(14, 120), gap=(8, 60), width=(4.5, 8.5), cut=False, on=col, bend=wbend,
                       tool='brush', end=0.5,
                       density=lambda x, y: np.clip(np.exp(-abs(x - GX) / (90 + 0.35 * (y - HOR))) * (1.25 - (y - HOR) / 420), 0, 1))
        st('water colour')
        st('water', major=True)

    def g_mist():
        rng = group('mist')
        # a band cleared with the U-gouge (scalloped edges, low ridges left in it), a few long broken wisps
        # left standing, and a thin printing of the colour caught in it
        ytop = lambda x: 634 - 44 * min(1.4, max(0, 1 - x / 1500)) + 8 * np.sin(x / 140)
        ybot = lambda x: 684 + 18 * min(1.4, max(0, 1 - x / 1400)) + 6 * np.sin(x / 110 + 1)
        outline_pts = scallop_band(rng, X0 - 20, X1 + 20, ytop, ybot, r=(9, 24))
        mist = L.poly(S.pts(outline_pts))
        L.clear(mist, chatter=0.55, angle=0)
        L.clear(mist, on=col, chatter=0)
        st('mist band')
        mbox = (X0, 560, X1, 720)
        gouge_rows(L, S, rng, mist, mbox, spacing=(5, 12), length=(30, 200), gap=(20, 140), width=(4, 8), cut=False,
                   on=col, tool='brush', end=0.5, bend=lambda x, y: 3 * np.sin(x / 230),
                   density=lambda x, y: (0.28 if day else 0.45) * np.exp(-((x - GX) / (900 if day else 520)) ** 2))
        st('mist colour')
        nw = 9 + int(9 * (X1 - X0 - 1980) / 1980)
        for i in range(nw):
            x = rng.uniform(X0, X1 - 220); ln = rng.uniform(70, 300)
            y = rng.uniform(ytop(x) + 6, ybot(x) - 8)
            ridge_line(L, S, rng, [(x, y), (x + ln * rng.uniform(0.35, 0.65), y - rng.uniform(1, 5)), (x + ln, y + rng.uniform(-2, 2))],
                       rng.uniform(2.6, 4.0), breaks=0.45, seg=(20, 90), gap=(4, 16))
            if i % 3 == 2: st('mist wisps')
        st('mist', major=True)

    def g_boat():
        rng = group('boat')
        BX, BY = 1170, 800
        Pk = lambda pts, **k: np.array(S.pts(knife_edge(pts, rng, step=(5, 12), wob=0.7, nick=0.06, nick_size=(1.5, 3), **k)), np.float32)
        hull = [(BX - 92, BY - 18), (BX - 50, BY - 10), (BX + 50, BY - 10), (BX + 94, BY - 20), (BX + 66, BY + 4), (BX - 66, BY + 4)]
        rower = [(BX - 16, BY - 12), (BX - 19, BY - 30), (BX - 17, BY - 44), (BX - 9, BY - 53), (BX + 1, BY - 50),
                 (BX + 5, BY - 38), (BX + 4, BY - 24), (BX + 7, BY - 12)]
        head = [(BX - 5 + 8.5 * np.cos(t) * (1 + 0.12 * np.sin(3 * t + 1)), BY - 62 + 8 * np.sin(t)) for t in np.linspace(0, 6.3, 14)]
        parts = [Pk(hull), Pk(rower), np.array(S.pts(head), np.float32),
                 L.stroke(S.pts([(BX - 40, BY - 40), (BX + 12, BY - 25), (BX + 74, BY + 15)]), S(4.6), 'brush', end=S(3.4), jitter=0.2),
                 L.stroke(S.pts([(BX + 64, BY + 8), (BX + 80, BY + 20)]), S(7), 'brush', end=S(3), jitter=0.2)]   # blade
        bm = L.mask_of(parts)
        L.outline(bm, S(3))
        L.leave(bm)
        st('boat')
        L.gouge(S.pts([(BX - 80, BY - 14), (BX - 20, BY - 6), (BX + 40, BY - 7), (BX + 82, BY - 16)]), S(2.4), 'v',
                taper=(0.2, 0.3))                                                                  # gunwale highlight
        L.gouge(S.pts([(BX - 4, BY - 47), (BX - 1, BY - 30)]), S(2.0), 'v', taper=(0.3, 0.4))     # lit back
        st('boat detail')
        # its reflection: a few broken dark strokes under the hull, shorter and swaying
        y = 811.0
        for k in range(5):
            w = (82 - k * 13) * rng.uniform(0.85, 1.1)
            xa = BX - w + rng.uniform(-6, 6)
            while xa < BX + w * 0.9:
                ln = rng.uniform(18, 60)
                xb = min(BX + w * 0.9, xa + ln)
                if rng.random() < 0.85 - 0.08 * k:
                    L.gouge(S.pts([(xa, y + rng.normal(0, 0.6)), (xb, y + rng.normal(0, 0.8))]),
                            S((4.2 - k * 0.45) * rng.uniform(0.8, 1.2)), 'brush', end=S(rng.uniform(1.4, 3)), cut=False)
                xa = xb + rng.uniform(3, 12)
            y += rng.uniform(8, 13)
        st('boat reflection')
        st('boat', major=True)

    def g_birds():
        rng = group('birds')
        for (bx, by, sc) in [(1380, 250, 1.0), (1440, 222, 0.8), (1505, 262, 0.7), (1590, 205, 0.9), (1665, 242, 0.6)]:
            k = sc * 1.4 * rng.uniform(0.85, 1.15)
            wd = 5.0 * max(k, 0.7) * (0.8 if day else 1.0)       # daytime: black birds left standing on the pale sky
            bird(L, S, rng, bx + rng.normal(0, 6), by + rng.normal(0, 5), 20 * k, wd, cut=not day)
            st('bird')
        st('birds', major=True)

    def g_reeds():
        rng = group('reeds')
        xl = min(-10, X0 + 10)
        n = 26 + int(26 * (-10 - xl) / 310)
        reeds = []
        for i in range(n):
            x = rng.uniform(xl, 300); h = rng.uniform(90, 210) * (1.15 - max(x, -60) / 420)
            lean = rng.normal(10, 12)
            base = max(1084, Y1 + 4)
            reeds.append(L.stroke(S.pts(spline([(x, base), (x + lean * 0.4, 1080 - h * 0.5), (x + lean, 1080 - h)], 8)),
                                  S(5), 'brush', end=S(1.2)))
            if rng.random() < 0.5:
                q = (x + lean * 0.3, 1080 - h * 0.35); side = rng.choice([-1, 1])
                reeds.append(L.stroke(S.pts([q, (q[0] + side * 30, q[1] - 40), (q[0] + side * 55, q[1] - 46)]), S(6), 'v'))
        third = (len(reeds) + 2) // 3
        for j in range(3):
            rmk = L.mask_of(reeds[j * third:(j + 1) * third])
            L.outline(rmk, S(2.4))
            L.leave(rmk)
            st('reeds')
        st('reeds', major=True)

    fns = dict(sky=g_sky, clouds=g_clouds, far=g_far, near=g_near, water=g_water, mist=g_mist, boat=g_boat,
               birds=g_birds, reeds=g_reeds)
    for g in GROUPS:
        if g in inc:
            fns[g]()

    group('finish')
    img = L.pull().convert('RGB')
    st.finish(img)
    return img


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else 'linocut_lake.png'
    W = int(sys.argv[2]) if len(sys.argv) > 2 else 1920
    H = int(sys.argv[3]) if len(sys.argv) > 3 else 1080
    cw = sys.argv[4] if len(sys.argv) > 4 else 'Vermilion'
    b = float(sys.argv[5]) if len(sys.argv) > 5 else 0.0
    save_png(paint(W, H, colourway=cw, bleed=b), out)
    print('saved', out)
