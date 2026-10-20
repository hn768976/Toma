"""Coastal village on a cliff — Linocut (黑白麻胶版画), vendor lib/linocut.py `Linocut`.
A black cliff headland on the right with a white lighthouse at its point and a row of cottages along the
top, the sea below with sailing boats, gulls overhead. Key block in black plus one spot-colour block:
`Vermilion` (low sun, glitter path, lit windows, the lighthouse beam, a red sail) or `Indigo` (a cool
daytime print: blue sky streaks, blue sea swells, a blue sail). Full bleed.

python scripts/scenes/linocut_coast.py out.png [W H [colourway [bleed]]]
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
                            ridge_line, carved_reflection, bird)

LIB = "linocut"
GROUPS = ("all",)

HOR = 600            # sea horizon
SUN = (520, 548, 62)
BASE = 735           # where the cliff meets the sea


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
    hor = S.y(HOR)
    rng = drawkit.group_rng(seed, 'all')
    L.rng = drawkit.group_rng(seed, 'all#lib')
    P = S.pts
    rect = lambda x0, y0, x1, y1: P([(x0, y0), (x1, y0), (x1, y1), (x0, y1)])
    SX, SY, SR = SUN

    geo = drawkit.group_rng(seed, 'geometry')
    sky_bend = lambda x, y: (52 * np.clip((SY - y) / 450, 0, 1.3) * ((x - SX) / 1000) ** 2
                             + 8 * np.sin(x / 360 + y / 140) + 4 * np.sin(x / 160 - y / 55))

    # ---------------------------------------------------------------- sky
    if day:
        day_sky(L, col, S, d, rng, rect(X0, Y0, X1, HOR + 2), (X0, Y0, X1, HOR + 2), 0, HOR, bend=sky_bend)
    else:
        L.clear(L.poly(rect(X0, 430, X1, HOR + 2)), chatter=0.35, angle=2)
        # bold V-gouge streaks arcing over the low sun, carved more and wider toward the horizon
        gouge_rows(L, S, rng, rect(X0, 40, X1, 440), (X0, 40, X1, 440), spacing=(12, 25), length=(60, 380),
                   gap=(10, 110), width=(3.8, 8.5), cut=True, bend=sky_bend, slip=0.05,
                   density=lambda x, y: np.clip((y - 95) / 300, 0.0, 1) ** 1.15)
        gd = lambda x, y: float(np.hypot((y - SY) * 1.5, x - SX))
        dens = lambda x, y: np.clip(0.95 - gd(x, y) / 900, 0.04, 0.8) * (y > 140)
        gouge_rows(L, S, rng, rect(X0, Y0, X1, HOR), (X0, Y0, X1, HOR), spacing=(5, 11), length=(40, 300), gap=(4, 40),
                   width=(5, 10), cut=False, on=col, bend=sky_bend, tool='brush', end=0.55, density=dens)
        # the low sun: a disc cut out of the key and printed in the colour, a black rim and a cleared ring round
        # it; its lower edge sits in the haze just above the horizon
        sun = L.disc(S.x(SX), S.y(SY), S(SR)) * (np.arange(CH)[:, None] < hor - S(10))
        L.clear(sun, chatter=0.15, angle=0)
        L.leave(sun, on=col)
        L.outline(sun, S(3.2), cut=False)               # a black rim so the disc reads against the streaks
        L.outline(L.disc(S.x(SX), S.y(SY), S(SR + 4)) * (np.arange(CH)[:, None] < hor - S(10)), S(5.0), on=col)
        for f in (0.33, 0.56, 0.76):                    # three ridges across the disc, uneven
            yy_ = SY + SR * (f - 0.5) * 1.6 + rng.uniform(-2, 2)
            hw = np.sqrt(max(SR ** 2 - (yy_ - SY) ** 2, 0)) * rng.uniform(0.7, 0.9)
            ridge_line(L, S, rng, [(SX - hw, yy_ + rng.uniform(-1, 1)), (SX + rng.uniform(-8, 8), yy_ - 1), (SX + hw, yy_ + rng.uniform(-1, 1.5))],
                       rng.uniform(2.8, 3.6), breaks=0.3, seg=(14, 50), region=sun)
    st('sky')

    # ---------------------------------------------------------------- clouds
    for (cx, cy, ln, k) in [(300, 150, 460, 0.9), (880, 108, 380, 0.75), (1380, 182, 520, 1.0), (1800, 96, 340, 0.7)]:
        if day:
            day_cloud(L, col, S, rng, cx, cy, ln, k)
            continue
        rows = 3 + int(rng.integers(0, 2) + 3 * k)
        ys = np.cumsum(rng.uniform(0.6, 1.4, rows)); ys = (ys - ys[0]) / max(ys[-1] - ys[0], 1e-6)
        sag = rng.uniform(-2.0, 3.0)
        for i in range(rows):
            f = ys[i]
            half = ln / 2 * (0.35 + 0.65 * np.sin(np.pi * (0.15 + 0.7 * f))) * rng.uniform(0.8, 1.15)
            y = cy + (f - 0.5) * 46 * k
            a, b = cx - half + rng.uniform(-30, 30) + 40 * (1 - f), cx + half + rng.uniform(-30, 30) - 20 * (1 - f)
            m = (a + b) / 2 + rng.uniform(-30, 30)
            w = ((2.2 + 2.6 * f) * k + 0.8) * rng.uniform(0.8, 1.25)
            L.gouge(P([(a, y + 1.5), (m, y - (1.8 + sag) * k), (b, y + rng.uniform(-1, 2.5))]), S(w), 'v',
                    taper=(rng.uniform(0.15, 0.45), rng.uniform(0.15, 0.45)))
            if f > 0.6:
                L.gouge(P([(a + 10, y + 2), (m, y + 0.5), (b - 10, y + 2)]), S(w + 2.5), 'v', cut=False, on=col, taper=(0.35, 0.35))
    st('clouds')

    # ---------------------------------------------------------------- far headland across the bay (left)
    fx = np.linspace(X0 - 40, 420, 30)
    fy = HOR - 30 * np.exp(-((fx - 60) / 170) ** 2) - 16 * np.exp(-((fx - 280) / 90) ** 2) + 2 * fbm1d(30, 5, 3, seed + 5)
    fy = np.minimum(fy + np.clip((fx - 340) * 0.25, 0, 40), HOR)
    fk = knife_edge(list(zip(fx, fy)), geo, step=(8, 26), wob=0.9, nick=0.06, nick_size=(2, 5), closed=False, side=1)
    far = P(fk + [(420, HOR + 2), (X0 - 40, HOR + 2)])
    L.clear(L.poly(far), on=col, chatter=0)
    L.outline(L.poly(far), S(2.4))
    L.leave(L.poly(far))                             # a low dark headland across the bay, a few cuts of haze
    gouge_rows(L, S, rng, far, (X0 - 40, HOR - 60, 430, HOR + 2), spacing=(5, 10), length=(14, 80), gap=(10, 60),
               width=(2.4, 3.6), cut=True, density=lambda x, y: 0.5)
    st('far headland')

    # ---------------------------------------------------------------- sea
    sea = rect(X0, HOR, X1, Y1)
    L.clear(L.poly(sea), chatter=0.4, angle=0)
    L.clear(L.poly(sea), on=col, chatter=0)
    glit = lambda x, y: np.exp(-abs(x - SX) / max(40.0, 40 + 0.55 * (y - HOR)))         # the sun's path widens toward us
    sbend = lambda x, y: 2.5 * np.sin(x / 120 + y / 26) + 2 * np.sin(x / 47 - y / 13)
    gouge_rows(L, S, rng, sea, (X0, HOR, X1, Y1), spacing=(9, 22), length=(26, 240), gap=(10, 110), width=(2.6, 4.8),
               cut=False, bend=sbend, tool='brush', end=0.45, cluster=0.6,
               density=lambda x, y: np.clip(0.1 + 0.95 * max(0.0, (y - HOR) / (1080 - HOR)) ** 1.2, 0, 0.95)
               * (1 - (0 if day else 0.75) * glit(x, y)))
    # swells: dark crescents left standing, every one its own length, sag, lean and weight, some doubled
    for _ in range(int(120 * (X1 - X0) / 1980)):
        x = rng.uniform(X0, X1); y = HOR + 20 + (Y1 - HOR - 20) * rng.random() ** 0.7
        if not day and glit(x, y) > 0.4: continue
        ln = (16 + 0.12 * (y - HOR)) * rng.uniform(0.55, 1.6)
        pk = rng.uniform(-0.35, 0.35)                         # where the crest sits
        sag = ln * rng.uniform(0.05, 0.22); lean = rng.normal(0, 0.06) * ln
        wv = (2.4 + 0.005 * (y - HOR)) * rng.uniform(0.8, 1.35)
        pts = [(x - ln, y + sag * rng.uniform(0.5, 1.0) + lean), (x + pk * ln, y - sag), (x + ln, y + sag * rng.uniform(0.3, 1.0) - lean)]
        L.gouge(P(pts), S(wv), 'v', cut=False, taper=(rng.uniform(0.1, 0.45), rng.uniform(0.1, 0.5)))
        if rng.random() < 0.18:
            o = rng.uniform(5, 9)
            L.gouge(P([(px + rng.uniform(4, 12), py + o) for px, py in pts]), S(wv * 0.75), 'v', cut=False)
    st('sea')
    if day:
        gouge_rows(L, S, rng, sea, (X0, HOR, X1, Y1), spacing=(6, 14), length=(30, 260), gap=(8, 70), width=(4.5, 8),
                   cut=False, on=col, bend=sbend, tool='brush', end=0.5,
                   density=lambda x, y: np.clip(0.2 + 0.85 * np.exp(-max(0.0, y - HOR) / 45)
                                                + 0.6 * max(0.0, (y - HOR) / 480) ** 0.8, 0, 0.92))
    else:
        gouge_rows(L, S, rng, P([(SX - 500, HOR + 3), (SX + 500, HOR + 3), (SX + 500, Y1), (SX - 500, Y1)]),
                   (SX - 500, HOR + 3, SX + 500, Y1), spacing=(5, 11), length=(14, 110), gap=(8, 50), width=(4.5, 8.5),
                   cut=False, on=col, bend=sbend, tool='brush', end=0.5,
                   density=lambda x, y: np.clip(glit(x, y) * 1.3 * (1.15 - (y - HOR) / 600), 0, 1))
    # the horizon: one long ridge left standing, uneven and broken here and there
    ridge_line(L, S, rng, [(X0, HOR + 0.5), (500, HOR), (X1, HOR + 0.5)], 3.0, breaks=0.35, seg=(60, 260), gap=(6, 30),
               smooth=False)
    st('sea colour')

    # ---------------------------------------------------------------- the cliff
    edge = [(760, BASE), (782, 700), (808, 642), (832, 590), (858, 532), (884, 482), (912, 444), (944, 416),
            (978, 400), (1010, 394)]
    tx = np.linspace(1010, X1 + 40, 26)
    ty = 392 - 52 * (tx - 1010) / 940 + 7 * fbm1d(26, 6, 3, seed + 31)
    top = list(zip(tx, ty))
    E = spline(edge + top[1:], 6)
    topf = lambda x: np.interp(x, E[:, 0], E[:, 1])
    bx = np.linspace(X1 + 40, 760, 30)
    by = BASE + 6 * np.sin(bx / 70) + 4 * fbm1d(30, 5, 2, seed + 32)
    # the silhouette re-cut by hand: knife facets, wobble and nicks (only the far-right closing edge kept)
    ck = knife_edge(E.tolist() + list(zip(bx, by)), geo, step=(9, 30), wob=2.0, nick=0.13, nick_size=(3, 11),
                    keep=lambda x, y: x < X1 + 20)
    cliff = P(ck)
    cm = L.poly(cliff)
    L.outline(cm, S(2.8))
    L.leave(cm)
    L.clear(cm, on=col, chatter=0)                     # no sky colour under the rock
    st('cliff block')
    # rock planes: the cliff is split into facets; in each the gouge runs along that plane (parallel to the
    # steep face near the edge, along the dipping beds inland), so the marks turn where the planes meet
    yy_d, xx_d = d.uy(np.arange(CH)[:, None].astype(np.float32)), d.ux(np.arange(CW)[None, :].astype(np.float32))
    seeds = [(800, 690), (850, 600), (900, 500), (960, 440), (1010, 560), (1000, 680), (1120, 470), (1190, 610),
             (1300, 520), (1420, 640), (1520, 480), (1640, 580), (1780, 500), (1880, 650), (2000, 560)]
    seeds = [(sx + geo.uniform(-30, 30), sy + geo.uniform(-25, 25)) for sx, sy in seeds]
    dist = np.stack([np.hypot((xx_d - sx) * 0.8, yy_d - sy) for sx, sy in seeds])
    lab = np.argmin(dist, 0)
    face_lit = lambda x, y: np.clip(1.0 - (x - 780) / 900, 0.3, 1)
    for k_, (sx, sy) in enumerate(seeds):
        fm = cm * (lab == k_)
        if fm.max() < 0.5: continue
        near_face = sx < 1060
        ang = (-54 + geo.normal(0, 7)) if near_face else (-4 + geo.normal(0, 9))
        if near_face and sy > 640: ang = -66 + geo.normal(0, 5)
        cv = geo.uniform(-0.03, 0.03)
        ys_, xs_ = np.nonzero(fm > 0.5)
        bb = (d.ux(xs_.min()), d.uy(ys_.min()), d.ux(xs_.max()), d.uy(ys_.max()))
        gouge_rows(L, S, rng, fm, bb, angle=ang, spacing=(9, 20), length=(18, 130), gap=(10, 70), width=(2.8, 5.4),
                   cut=True, slip=0.06, bend=lambda x, y, sx=sx, cv=cv: cv * (x - sx) ** 2 * 0.05 + 3 * np.sin(x / 70 + y / 50),
                   density=lambda x, y: np.clip(0.18 + 0.58 * face_lit(x, y) + 0.15 * np.exp(-(y - topf(x)) / 40), 0, 0.9))
    st('cliff planes')
    # fissures in the lit face: black ridges left in the carved face, irregular
    for _ in range(14):
        x = rng.uniform(800, 1080); y0 = max(topf(x), np.interp(x, [760, 1010], [BASE, 394])) + rng.uniform(40, 90)
        ln = rng.uniform(40, 130)
        if y0 + ln > BASE - 10: continue
        L.gouge(P([(x, y0), (x + rng.uniform(-10, 10), y0 + ln * rng.uniform(0.35, 0.65)), (x + rng.uniform(-16, 16), y0 + ln)]),
                S(rng.uniform(2.4, 4.0)), 'v', cut=False, taper=(rng.uniform(0.1, 0.4), rng.uniform(0.2, 0.5)))
    st('cliff strata')
    # grass along the top: clustered tufts of short V cuts fanning up from a lit strip under the edge
    x = 990.0
    while x < X1:
        n = int(rng.integers(2, 6)); lean0 = rng.normal(0.25, 0.25)
        for _ in range(n):
            xg = x + rng.uniform(-6, 6); y = topf(xg) + rng.uniform(6, 13); h = rng.uniform(6, 15)
            a = lean0 + rng.normal(0, 0.3)
            L.gouge(P([(xg, y + h * 0.4), (xg + np.sin(a) * h, y + h * 0.4 - np.cos(a) * h)]), S(rng.uniform(2.2, 3.4)), 'v',
                    taper=(0.05, 0.6), smooth=False)
        x += rng.uniform(10, 34)
    ridge_line(L, S, rng, [(985, topf(985) + 4), (1400, topf(1400) + 4), (X1, topf(X1) + 4)], 2.8, breaks=0.5,
               seg=(30, 120), gap=(6, 30), cut=True)
    st('cliff grass')

    # ---------------------------------------------------------------- cottages along the top
    def cottage(x, w, wall, roof, side, lit=(), seedk=0):
        base = topf(x + w / 2) + 10
        ax = x + w / 2 + rng.uniform(-3, 3); ay = base - wall - roof
        rise = -0.08 + rng.uniform(-0.02, 0.02)
        front = [(x, base), (x, base - wall), (ax, ay), (x + w, base - wall), (x + w, base)]
        sidew = [(x + w, base), (x + w + side, base + side * rise), (x + w + side, base - wall + side * rise),
                 (x + w, base - wall)]
        roofp = [(ax, ay), (ax + side, ay + side * rise), (x + w + side + 4, base - wall + side * rise + 3), (x + w + 4, base - wall + 3)]
        kn = lambda q: np.array(P(knife_edge(q, rng, step=(6, 16), wob=0.6, nick=0.05, nick_size=(1.5, 3))), np.float32)
        m = L.mask_of([kn(front), kn(sidew), kn(roofp)])
        L.outline(m, S(3.0))
        L.leave(m)
        L.clear(m, on=col, chatter=0)
        # roof: slates as bold broken cuts across the slope (it catches the light); a black ridge line left
        ra = np.degrees(np.arctan2(roof, w / 2)) + 4
        gouge_rows(L, S, rng, P(roofp), (x + w - 10, ay - 4, x + w + side + 10, base - wall + 8), angle=ra,
                   spacing=(5.5, 8.5), length=(8, 34), gap=(4, 12), width=(2.6, 3.6), cut=True, density=lambda x_, y_: 0.8,
                   bow=0.2)
        ridge_line(L, S, rng, [(ax, ay + 1), (ax + side, ay + side * rise + 1)], 3.0, breaks=0.2, seg=(14, 40), smooth=False)
        # side wall: a couple of board lines
        for f in (0.33 + rng.uniform(-0.05, 0.05), 0.68 + rng.uniform(-0.05, 0.05)):
            yy_ = base - wall * f
            L.gouge(P([(x + w + rng.uniform(3, 8), yy_), (x + w + side - rng.uniform(3, 12), yy_ + side * rise)]),
                    S(rng.uniform(2.2, 3.0)), 'v', smooth=False)
        # front: windows (glazing bars left as bold ridges)
        for (u, v, ww, wh) in lit:
            qx0, qy0 = x + u, base - v - wh
            q = rect(qx0, qy0, qx0 + ww, qy0 + wh)
            L.clear(L.poly(q), chatter=0)
            if not day:
                L.leave(L.poly(rect(qx0 - 1, qy0 - 1, qx0 + ww + 1, qy0 + wh + 1)), on=col)
            L.gouge(P([(qx0 + ww / 2 + rng.uniform(-1, 1), qy0), (qx0 + ww / 2, qy0 + wh)]), S(rng.uniform(2.6, 3.4)), 'brush',
                    end=S(2.4), cut=False, smooth=False, jitter=0.25)
            L.gouge(P([(qx0, qy0 + wh * 0.5), (qx0 + ww, qy0 + wh * 0.5 + rng.uniform(-1, 1))]), S(rng.uniform(2.6, 3.4)), 'brush',
                    end=S(2.4), cut=False, smooth=False, jitter=0.25)
        return base

    houses = [  # x, front w, wall, roof, side depth, windows
        (1268, 64, 46, 34, 70, [(12, 16, 14, 16), (38, 16, 14, 16)]),
        (1400, 78, 54, 40, 54, [(14, 18, 16, 18), (46, 18, 16, 18)]),
        (1520, 56, 40, 32, 80, [(20, 14, 14, 15)]),
        (1655, 84, 60, 44, 60, [(12, 20, 16, 20), (52, 20, 16, 20), (32, 46, 14, 14)]),
        (1795, 62, 44, 34, 66, [(14, 15, 14, 16), (38, 15, 14, 16)]),
    ]
    if S.X1 > 1990:
        houses.append((1925, 70, 50, 38, 60, [(14, 16, 14, 16), (42, 16, 14, 16)]))
    for (x, w, wall, roof, side, win) in houses:
        cottage(x, w, wall, roof, side, win)
        st('cottage')
    # chimneys
    for (x, w, wall, roof) in [(1400, 78, 54, 40), (1655, 84, 60, 44)]:
        base = topf(x + w / 2) + 10
        cx, cy = x + w + 22, base - wall - roof * 0.55
        cp = P(knife_edge([(cx, cy - 22), (cx + 12, cy - 22), (cx + 12, cy + 6), (cx, cy + 6)], rng, step=(5, 10), wob=0.6, nick=0.1,
                          nick_size=(1.5, 3)))
        L.outline(L.poly(cp), S(2.5)); L.leave(L.poly(cp))
    st('chimneys')

    # ---------------------------------------------------------------- the lighthouse at the point
    LX, LB = 1062, topf(1062) + 12
    th, rb, rt = 196, 26, 17                            # tower height, base and top half-widths
    LT = LB - th
    tower = [(LX - rb, LB), (LX - rt, LT), (LX + rt, LT), (LX + rb, LB)]
    tm = L.poly(P(knife_edge(tower, rng, step=(8, 22), wob=0.8, nick=0.08, nick_size=(1.5, 4))))
    L.outline(tm, S(3.4))                               # halo cut round it into the black
    L.leave(tm)
    L.clear(tm, on=col, chatter=0)
    L.clear(L.poly(P(knife_edge([(LX - rb + 4, LB - 2), (LX - rt + 3, LT + 3), (LX + rt - 3, LT + 3), (LX + rb - 4, LB - 2)],
                                rng, step=(8, 20), wob=0.6, nick=0.0))), chatter=0.15, angle=90)
    # two black bands (their edges hand-cut); shading on the right side as bold ridges left standing
    for (fa, fb) in ((0.22, 0.38), (0.58, 0.74)):
        ya, yb = LB - th * fa, LB - th * fb
        wa, wb = rb + (rt - rb) * fa, rb + (rt - rb) * fb
        L.leave(L.poly(P(knife_edge([(LX - wa, ya), (LX - wb, yb), (LX + wb, yb), (LX + wa, ya)], rng, step=(5, 12), wob=0.7,
                                    nick=0.05, nick_size=(1.5, 3)))))
    for k in range(3):
        f = 0.38 + 0.2 * k + rng.uniform(-0.04, 0.04)
        ridge_line(L, S, rng, [(LX + rb * f, LB - 4), (LX + rt * f, LT + 6)], 2.8 + 0.5 * k, breaks=0.3, seg=(20, 60), smooth=False)
    # gallery: a bold rail and a few stout posts (fragile ridges, printed uneven), lantern, dome
    L.leave(L.poly(P(knife_edge([(LX - rt - 9, LT + 2), (LX + rt + 9, LT + 2), (LX + rt + 9, LT - 6), (LX - rt - 9, LT - 6)],
                                rng, step=(5, 10), wob=0.5, nick=0.05, nick_size=(1.2, 2.5)))))
    for xx in np.linspace(LX - rt - 7, LX + rt + 7, 5) + rng.uniform(-1.5, 1.5, 5):
        ridge_line(L, S, rng, [(xx, LT - 5), (xx + rng.uniform(-0.8, 0.8), LT - 16)], rng.uniform(2.8, 3.6), breaks=0.25,
                   seg=(4, 10), gap=(1.5, 3), smooth=False)
    ridge_line(L, S, rng, [(LX - rt - 9, LT - 16), (LX + rt + 9, LT - 16.5)], 3.2, breaks=0.25, seg=(10, 30), gap=(2, 4), smooth=False)
    lan = P([(LX - 11, LT - 5), (LX + 11, LT - 5), (LX + 11, LT - 30), (LX - 11, LT - 30)])
    L.outline(L.poly(lan), S(2.4)); L.leave(L.poly(lan))
    glass = P([(LX - 8, LT - 8), (LX + 8, LT - 8), (LX + 8, LT - 27), (LX - 8, LT - 27)])
    L.clear(L.poly(glass), chatter=0)
    if not day:
        L.leave(L.poly(P([(LX - 9, LT - 7), (LX + 9, LT - 7), (LX + 9, LT - 28), (LX - 9, LT - 28)])), on=col)
    L.gouge(P([(LX, LT - 8), (LX + 0.5, LT - 27)]), S(3.0), 'brush', end=S(2.4), cut=False, smooth=False, jitter=0.25)
    dome = [(LX - 14, LT - 30), (LX - 8, LT - 40), (LX, LT - 44), (LX + 8, LT - 40), (LX + 14, LT - 30)]
    L.outline(L.poly(P(dome)), S(2.4)); L.leave(L.poly(P(dome)))
    L.gouge(P([(LX, LT - 44), (LX + 1, LT - 57)]), S(3.0), 'brush', end=S(1.8), cut=False, smooth=False, jitter=0.2)
    # keeper's cottage at its foot
    kx = LX + 30
    kh = [(kx, LB + 2), (kx, LB - 30), (kx + 28, LB - 50), (kx + 56, LB - 30), (kx + 56, LB + 2)]
    km = L.poly(P(knife_edge(kh, rng, step=(6, 14), wob=0.6, nick=0.06, nick_size=(1.5, 3)))); L.outline(km, S(2.6)); L.leave(km)
    L.clear(L.poly(rect(kx + 20, LB - 22, kx + 34, LB - 8)), chatter=0)
    if not day:
        L.leave(L.poly(rect(kx + 19, LB - 23, kx + 35, LB - 7)), on=col)
    st('lighthouse')
    if not day:
        # beams: two long fans of cuts from the lantern into the dusk sky, printed in the colour; each cut its
        # own length, weight and a slight waver of the hand
        for ang, ln in ((198, 640), (-14, 560)):
            for j in range(9):
                a = np.radians(ang + (j - 4) * 0.9 + rng.normal(0, 0.15))
                x0, y0 = LX + np.cos(a) * 26, LT - 18 + np.sin(a) * 26
                L_ = ln * (1 - abs(j - 4) * 0.07) * rng.uniform(0.82, 1.08)
                tt = np.linspace(0, 1, 8)
                wv = rng.normal(0, 2.0) * np.sin(np.pi * tt)
                pts = P([(x0 + np.cos(a) * L_ * t - np.sin(a) * o, y0 + np.sin(a) * L_ * t + np.cos(a) * o) for t, o in zip(tt, wv)])
                wd = (3.6 - abs(j - 4) * 0.3) * rng.uniform(0.85, 1.2)
                L.gouge(pts, S(wd), 'v', taper=(0.04, rng.uniform(0.7, 0.9)), smooth=False)
                L.gouge(pts, S(wd + 0.8), 'v', cut=False, on=col, taper=(0.04, 0.85), smooth=False)
        st('beams')

    # ---------------------------------------------------------------- the cliff's reflection, surf at its foot
    # carved as broken horizontal strokes (shorter than the cliff, breaking up with depth), not a mirrored block
    cmx = cm * (np.arange(CW)[None, :] > S.x(770))
    carved_reflection(L, S, rng, cmx, BASE + 9, 190, squash=0.85, rows=(4.0, 7.5), dash=(20, 120), gap=(3, 18),
                      keep0=0.95, keep1=0.3, sway=(2.5, 1.0), region=sea)
    st('cliff reflection')
    for _ in range(int(70 * max(1.0, (X1 - 760) / 1190))):
        x = rng.uniform(770, X1); y = np.interp(x, bx[::-1], by[::-1]) + rng.uniform(-6, 16)
        ln = rng.uniform(14, 52)
        L.gouge(P([(x, y), (x + ln * rng.uniform(0.35, 0.65), y - rng.uniform(2, 7)), (x + ln, y + rng.uniform(-1, 3))]),
                S(rng.uniform(3, 6.5)), 'u', taper=(0, rng.uniform(0.25, 0.55)))
    st('surf')

    # ---------------------------------------------------------------- sailing boats
    def boat(x, y, h, main_col=False, flip=1):
        k = h / 180
        kn = lambda q, **kw: knife_edge(q, rng, step=(5, 14), wob=0.5 * max(k, 0.5), nick=0.05, nick_size=(1.2, 2.5), **kw)
        hull = [(x - 110 * k * flip, y - 14 * k), (x + 120 * k * flip, y - 16 * k), (x + 96 * k * flip, y + 10 * k),
                (x - 86 * k * flip, y + 10 * k)]
        mx_ = x + 6 * k * flip
        mast = L.stroke(P([(mx_, y - 12 * k), (mx_ + rng.normal(0, 1.0) * k, y - h * 0.55), (mx_ + rng.normal(0, 1.5) * k, y - h)]),
                        S(max(3.0, 4.6 * k)), 'brush', end=S(max(2.6, 3.4 * k)), jitter=0.2)
        belly = rng.uniform(0.9, 1.15)
        mainsail = [(x + 12 * k * flip, y - h + 8 * k), (x + 12 * k * flip, y - 22 * k), (x + 104 * k * flip * belly, y - 22 * k),
                    (x + 60 * k * flip * belly, y - h * 0.5)]
        jib = [(x, y - h + 14 * k), (x - 96 * k * flip * rng.uniform(0.85, 1.1), y - 22 * k), (x - 4 * k * flip, y - 22 * k)]
        hm = L.mask_of([np.array(P(kn(hull)), np.float32), mast])
        sm = L.poly(P(spline(mainsail + [mainsail[0]], 6).tolist())); jm = L.poly(P(jib))
        L.clear(np.maximum(sm, jm), chatter=0)
        # the sails' black edges: bold ridges left standing, uneven and broken here and there
        ew = max(2.8, 3.2 * k)
        ms = spline(mainsail + [mainsail[0]], 6)
        ridge_line(L, S, rng, ms.tolist(), ew, breaks=0.2, seg=(20, 70), gap=(2, 5), smooth=False)
        ridge_line(L, S, rng, jib + [jib[0]], ew, breaks=0.2, seg=(20, 70), gap=(2, 5), smooth=False)
        if main_col:
            L.leave(sm, on=col)
        for f in (0.3, 0.55, 0.78):                                           # seams on the mainsail
            if rng.random() < 0.2: continue
            ya = y - 22 * k - (h - 30 * k) * (f + rng.uniform(-0.04, 0.04))
            ridge_line(L, S, rng, [(x + 12 * k * flip, ya), (x + (104 - 70 * f) * k * flip, ya + 8 * k * rng.uniform(0.7, 1.3))],
                       max(2.6, 2.8 * k), breaks=0.35, seg=(12, 40), region=sm, smooth=False)
        L.outline(hm, S(max(2.0, 2.6 * k)))
        L.leave(hm)
        L.gouge(P([(x - 96 * k * flip, y - 8 * k), (x + 104 * k * flip, y - 10 * k)]), S(max(2.4, 2.4 * k)), 'v')
        # broken reflection of the hull and sail: a few swaying dashes, shorter with depth
        yy_ = y + 14 * k
        for j in range(int(rng.integers(3, 6))):
            w = (100 - 20 * j) * k * rng.uniform(0.8, 1.1)
            xa = x - w + rng.uniform(-8, 8) * k
            while xa < x + w * 0.9:
                xb = min(x + w * 0.9, xa + rng.uniform(14, 60) * max(k, 0.5))
                if rng.random() < 0.85 - 0.1 * j:
                    L.gouge(P([(xa, yy_ + rng.normal(0, 0.6)), (xb, yy_ + rng.normal(0, 0.8))]),
                            S(max(2.6, (4.4 - j * 0.6) * k * 1.3 * rng.uniform(0.8, 1.2))), 'brush', end=S(rng.uniform(1.4, 2.6)),
                            cut=False)
                xa = xb + rng.uniform(3, 12) * max(k, 0.5)
            yy_ += rng.uniform(8, 13) * max(k, 0.6)

    boat(700, 640, 78, flip=-1)
    st('boat')
    boat(180, 724, 120)
    st('boat')
    boat(450, 870, 210, main_col=True)
    st('boat')

    # ---------------------------------------------------------------- gulls (each its own wingbeat and weight)
    gulls = [(640, 250, 1.2), (735, 300, 0.9), (820, 228, 0.8), (930, 330, 0.7), (580, 360, 0.75), (1160, 250, 0.9)]
    for (gx_, gy_, sc) in gulls:
        k = sc * 1.5 * rng.uniform(0.85, 1.15)
        bird(L, S, rng, gx_ + rng.normal(0, 8), gy_ + rng.normal(0, 6), 27 * k,
             (3.8 if day else 4.6) * max(k / 1.4, 0.8), cut=not day, kind='gull')
    # two gulls low over the sea: black, left standing
    for (gx_, gy_, sc) in [(300, 640, 0.9), (360, 668, 0.7)]:
        k = sc * 1.5 * rng.uniform(0.85, 1.15)
        bird(L, S, rng, gx_, gy_, 27 * k, 4.2 * max(k / 1.4, 0.8), cut=False, kind='gull')
    st('gulls')

    # ---------------------------------------------------------------- foreground rocks in the surf (bottom right)
    rocks = [(1560, 1010, 150, 70), (1760, 975, 210, 110), (1950, 1000, 180, 120), (1420, 1060, 110, 50)]
    for (cx, cy, rx, ry) in rocks:
        t = np.linspace(np.pi, 2 * np.pi, 24)
        wob = 1 + 0.12 * fbm1d(24, 5, 3, int(rng.integers(1 << 30)))
        pts = [(cx + np.cos(a) * rx * w, cy + np.sin(a) * ry * w) for a, w in zip(t, wob)]
        pts += [(cx + rx, max(cy + 40, Y1 + 10)), (cx - rx, max(cy + 40, Y1 + 10))]
        pts = knife_edge(pts, rng, step=(8, 24), wob=1.4, nick=0.12, nick_size=(2.5, 7))
        rmk = L.poly(P(pts))
        # halo only round the rounded back: lower down the rocks merge into one black mass (no ruled verticals)
        L.outline(rmk * (np.arange(CH)[:, None] < S.y(cy + rng.uniform(-10, 25))), S(3.0))
        L.leave(rmk)
        # gouge marks following the rock's rounded back: rows curving over it
        gouge_rows(L, S, rng, P(pts), (cx - rx - 10, cy - ry - 10, cx + rx + 10, cy + 60), angle=-24 + rng.normal(0, 8),
                   spacing=(8, 15), length=(14, 60), gap=(8, 30), width=(2.8, 4.6), cut=True, slip=0.08,
                   bend=lambda x, y, cx=cx, rx=rx: 22 * ((x - cx) / rx) ** 2,
                   density=lambda x, y, cx=cx, cy=cy, ry=ry: np.clip(0.75 - (y - (cy - ry)) / (ry * 1.4), 0, 0.8))
        for _ in range(int(rng.integers(6, 11))):                           # foam breaking round it
            a = rng.uniform(np.pi * 1.05, np.pi * 1.95)
            fx_, fy_ = cx + np.cos(a) * rx * 1.06, cy + np.sin(a) * ry * 1.04 + 30
            if fy_ > cy + 10: continue
            l1, l2 = rng.uniform(10, 28), rng.uniform(10, 30)
            L.gouge(P([(fx_ - l1, fy_ + rng.uniform(2, 6)), (fx_ + rng.uniform(-4, 4), fy_ - rng.uniform(1, 5)), (fx_ + l2, fy_ + rng.uniform(2, 7))]),
                    S(rng.uniform(3.2, 6.0)), 'u', taper=(0, rng.uniform(0.25, 0.55)))
    st('rocks')

    L.rng = drawkit.group_rng(seed, 'finish')
    img = L.pull().convert('RGB')
    st.finish(img)
    return img


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else 'linocut_coast.png'
    W = int(sys.argv[2]) if len(sys.argv) > 2 else 1920
    H = int(sys.argv[3]) if len(sys.argv) > 3 else 1080
    cw = sys.argv[4] if len(sys.argv) > 4 else 'Vermilion'
    b = float(sys.argv[5]) if len(sys.argv) > 5 else 0.0
    save_png(paint(W, H, colourway=cw, bleed=b), out)
    print('saved', out)
