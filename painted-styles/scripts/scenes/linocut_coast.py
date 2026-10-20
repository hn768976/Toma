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
from linocut_common import STYLE, COLOURWAYS, make_print, D, Stager, day_sky, day_cloud

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

    # ---------------------------------------------------------------- sky
    if day:
        day_sky(L, col, S, d, rect(X0, Y0, X1, HOR + 2), 0, HOR)
    else:
        L.clear(L.poly(rect(X0, 430, X1, HOR + 2)), chatter=0.35, angle=2)
        L.hatch(rect(X0, 50, X1, 440), angle=0, spacing=S(8), width=S(3.4), dash=(S(60), S(320)), gap=(S(8), S(50)),
                cut=True, density=d.fn(lambda x, y: np.clip((y - 100) / 300, 0.0, 1) ** 1.15),
                bend=lambda x, y: S(5) * np.sin(d.ux(x) / 240 + d.uy(y) / 80))
        gd = lambda x, y: float(np.hypot((y - SY) * 1.5, x - SX))
        dens = lambda x, y: np.clip(0.95 - gd(x, y) / 900, 0.04, 0.8) * (y > 140)
        L.hatch(rect(X0, Y0, X1, HOR), angle=0, spacing=S(5), width=S(5.0), dash=(S(40), S(260)), gap=(S(4), S(30)),
                cut=False, on=col, density=d.fn(dens))
        # the low sun: a disc cut out of the key and printed in the colour, a black rim and a cleared ring round
        # it; its lower edge sits in the haze just above the horizon
        sun = L.disc(S.x(SX), S.y(SY), S(SR)) * (np.arange(CH)[:, None] < hor - S(10))
        L.clear(sun, chatter=0.15, angle=0)
        L.leave(sun, on=col)
        L.outline(sun, S(3.0), cut=False)               # a black rim so the disc reads against the streaks
        L.outline(L.disc(S.x(SX), S.y(SY), S(SR + 4)) * (np.arange(CH)[:, None] < hor - S(10)), S(5.0), on=col)
        for f in (0.35, 0.55, 0.75):                    # three thin ridges across the disc
            yy = SY + SR * (f - 0.5) * 1.6
            hw = np.sqrt(max(SR ** 2 - (yy - SY) ** 2, 0)) * 0.85
            L.gouge(P([(SX - hw, yy), (SX + hw, yy + 1)]), S(2.2), 'v', cut=False, region=sun)
    st('sky')

    # ---------------------------------------------------------------- clouds
    for (cx, cy, ln, k) in [(300, 150, 460, 0.9), (880, 108, 380, 0.75), (1380, 182, 520, 1.0), (1800, 96, 340, 0.7)]:
        if day:
            day_cloud(L, col, S, rng, cx, cy, ln, k)
            continue
        rows = 4 + int(3 * k)
        for i in range(rows):
            f = i / (rows - 1)
            half = ln / 2 * (0.35 + 0.65 * np.sin(np.pi * (0.15 + 0.7 * f))) * rng.uniform(0.85, 1.1)
            y = cy + (f - 0.5) * 46 * k
            a, b = cx - half + rng.uniform(-30, 30) + 40 * (1 - f), cx + half + rng.uniform(-30, 30) - 20 * (1 - f)
            m = (a + b) / 2
            w = (1.8 + 2.0 * f) * k + 0.6
            L.gouge(P([(a, y + 1.5), (m, y - 1.8 * k), (b, y + 1.2)]), S(w), 'v', taper=(0.35, 0.35))
            if f > 0.6:
                L.gouge(P([(a + 10, y + 2), (m, y + 0.5), (b - 10, y + 2)]), S(w + 2.5), 'v', cut=False, on=col, taper=(0.35, 0.35))
    st('clouds')

    # ---------------------------------------------------------------- far headland across the bay (left)
    fx = np.linspace(X0 - 40, 420, 30)
    fy = HOR - 30 * np.exp(-((fx - 60) / 170) ** 2) - 16 * np.exp(-((fx - 280) / 90) ** 2) + 2 * fbm1d(30, 5, 3, seed + 5)
    fy = np.minimum(fy + np.clip((fx - 340) * 0.25, 0, 40), HOR)
    far = P(list(zip(fx, fy)) + [(420, HOR + 2), (X0 - 40, HOR + 2)])
    L.clear(L.poly(far), on=col, chatter=0)
    L.outline(L.poly(far), S(2.0))
    L.leave(L.poly(far))                             # a low dark headland across the bay, a few cuts of haze
    L.hatch(far, angle=0, spacing=S(5), width=S(1.8), dash=(S(18), S(90)), gap=(S(10), S(50)), cut=True,
            density=d.fn(lambda x, y: 0.5))
    st('far headland')

    # ---------------------------------------------------------------- sea
    sea = rect(X0, HOR, X1, Y1)
    L.clear(L.poly(sea), chatter=0.4, angle=0)
    L.clear(L.poly(sea), on=col, chatter=0)
    glit = lambda x, y: np.exp(-abs(x - SX) / (40 + 0.55 * (y - HOR)))         # the sun's path widens toward us
    L.hatch(sea, angle=0, spacing=S(10), width=S(2.6), dash=(S(30), S(240)), gap=(S(10), S(80)), cut=False,
            bend=lambda x, y: S(2.5) * np.sin(d.ux(x) / 120 + d.uy(y) / 26),
            density=d.fn(lambda x, y: np.clip(0.1 + 0.95 * max(0.0, (y - HOR) / (1080 - HOR)) ** 1.2, 0, 0.95)
                         * (1 - (0 if day else 0.75) * glit(x, y))))
    # short swells: dark arcs left standing, denser toward the viewer
    for _ in range(int(150 * (X1 - X0) / 1980)):
        x = rng.uniform(X0, X1); y = HOR + 20 + (Y1 - HOR - 20) * rng.random() ** 0.7
        if not day and glit(x, y) > 0.4: continue
        ln = 18 + 0.12 * (y - HOR) * rng.uniform(0.6, 1.4)
        L.gouge(P([(x - ln, y + ln * 0.08), (x, y - ln * 0.12), (x + ln, y + ln * 0.08)]), S(1.6 + 0.004 * (y - HOR)),
                'v', cut=False)
    st('sea')
    if day:
        L.hatch(sea, angle=0, spacing=S(7), width=S(4.2), dash=(S(30), S(220)), gap=(S(8), S(60)), cut=False, on=col,
                density=d.fn(lambda x, y: np.clip(0.2 + 0.85 * np.exp(-max(0.0, y - HOR) / 45)
                                                  + 0.6 * max(0.0, (y - HOR) / 480) ** 0.8, 0, 0.92)))
    else:
        L.hatch(P([(SX - 500, HOR + 3), (SX + 500, HOR + 3), (SX + 500, Y1), (SX - 500, Y1)]), angle=0, spacing=S(7),
                width=S(4.6), dash=(S(14), S(100)), gap=(S(8), S(46)), cut=False, on=col,
                density=d.fn(lambda x, y: np.clip(glit(x, y) * 1.3 * (1.15 - (y - HOR) / 600), 0, 1)))
    # the horizon: one long ridge left standing, broken here and there
    for (a, b) in ((X0, 230), (250, 610), (640, 900), (925, X1)):
        L.gouge(P([(a, HOR + 0.5), ((a + b) / 2, HOR), (b, HOR + 0.5)]), S(2.4), 'knife', cut=False)
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
    cliff = P(E.tolist() + list(zip(bx, by)))
    cm = L.poly(cliff)
    L.outline(cm, S(2.6))
    L.leave(cm)
    st('cliff block')
    # rock strata: long cuts running along the beds (slightly dipping), lit face at the left densest
    face_lit = lambda x, y: np.clip(1.0 - (x - 780) / 900, 0.3, 1)
    L.hatch(cliff, angle=-4, spacing=S(9), width=S(2.6), dash=(S(24), S(150)), gap=(S(12), S(60)), cut=True,
            bend=lambda x, y: S(10) * np.sin(d.ux(x) / 210),
            density=d.fn(lambda x, y: np.clip(0.2 + 0.6 * face_lit(x, y) + 0.15 * np.exp(-(y - topf(x)) / 40), 0, 0.92)))
    # vertical fissures in the lit face
    for _ in range(18):
        x = rng.uniform(800, 1080); y0 = max(topf(x), np.interp(x, [760, 1010], [BASE, 394])) + rng.uniform(40, 90)
        ln = rng.uniform(40, 120)
        if y0 + ln > BASE - 10: continue
        L.gouge(P([(x, y0), (x + rng.uniform(-8, 8), y0 + ln * 0.5), (x + rng.uniform(-12, 12), y0 + ln)]),
                S(rng.uniform(1.6, 2.8)), 'v', cut=False)
    st('cliff strata')
    # grass along the top: short upright V cuts in a lit strip under the edge
    gx = np.arange(990, X1, 7.0)
    for x in gx:
        x = x + rng.uniform(-2, 2); y = topf(x) + rng.uniform(5, 13); h = rng.uniform(10, 22)
        L.gouge(P([(x, y + h), (x + rng.uniform(-3, 3), y)]), S(rng.uniform(2.0, 3.2)), 'v', taper=(0.05, 0.6),
                smooth=False)
    L.gouge(P([(985, topf(985) + 4), (1400, topf(1400) + 4), (X1, topf(X1) + 4)]), S(2.4), 'v', smooth=True)
    st('cliff grass')

    # ---------------------------------------------------------------- cottages along the top
    def cottage(x, w, wall, roof, side, lit=(), seedk=0):
        base = topf(x + w / 2) + 10
        ax = x + w / 2; ay = base - wall - roof
        rise = -0.08
        front = [(x, base), (x, base - wall), (ax, ay), (x + w, base - wall), (x + w, base)]
        sidew = [(x + w, base), (x + w + side, base + side * rise), (x + w + side, base - wall + side * rise),
                 (x + w, base - wall)]
        roofp = [(ax, ay), (ax + side, ay + side * rise), (x + w + side + 4, base - wall + side * rise + 3), (x + w + 4, base - wall + 3)]
        m = L.mask_of([np.array(P(front), np.float32), np.array(P(sidew), np.float32), np.array(P(roofp), np.float32)])
        L.outline(m, S(3.0))
        L.leave(m)
        # roof: slates as dense cuts across the slope (it catches the light); a black ridge line left
        L.hatch(P(roofp), angle=np.degrees(np.arctan2(roof, w / 2)) + 4, spacing=S(4.6), width=S(2.2),
                dash=(S(10), S(40)), gap=(S(4), S(12)), cut=True, density=lambda x_, y_: 0.8)
        L.gouge(P([(ax, ay + 1), (ax + side, ay + side * rise + 1)]), S(2.6), 'knife', cut=False, smooth=False)
        # side wall: a couple of board lines
        for f in (0.35, 0.7):
            yy = base - wall * f
            L.gouge(P([(x + w + 3, yy), (x + w + side - 3, yy + side * rise)]), S(1.6), 'v', smooth=False)
        # front: windows and a door
        for (u, v, ww, wh) in lit:
            qx0, qy0 = x + u, base - v - wh
            q = rect(qx0, qy0, qx0 + ww, qy0 + wh)
            L.clear(L.poly(q), chatter=0)
            if not day:
                L.leave(L.poly(rect(qx0 - 1, qy0 - 1, qx0 + ww + 1, qy0 + wh + 1)), on=col)
            L.gouge(P([(qx0 + ww / 2, qy0), (qx0 + ww / 2, qy0 + wh)]), S(1.8), 'knife', cut=False, smooth=False)
            L.gouge(P([(qx0, qy0 + wh * 0.5), (qx0 + ww, qy0 + wh * 0.5)]), S(1.8), 'knife', cut=False, smooth=False)
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
    # chimneys with a wisp of smoke cut into the sky
    for (x, w, wall, roof) in [(1400, 78, 54, 40), (1655, 84, 60, 44)]:
        base = topf(x + w / 2) + 10
        cx, cy = x + w + 22, base - wall - roof * 0.55
        cp = rect(cx, cy - 22, cx + 12, cy + 6)
        L.outline(L.poly(cp), S(2.5)); L.leave(L.poly(cp))
    st('chimneys')

    # ---------------------------------------------------------------- the lighthouse at the point
    LX, LB = 1062, topf(1062) + 12
    th, rb, rt = 196, 26, 17                            # tower height, base and top half-widths
    LT = LB - th
    tower = [(LX - rb, LB), (LX - rt, LT), (LX + rt, LT), (LX + rb, LB)]
    tm = L.poly(P(tower))
    L.outline(tm, S(3.2))                               # halo cut round it into the black
    L.leave(tm)
    L.clear(L.poly(P([(LX - rb + 4, LB - 2), (LX - rt + 3, LT + 3), (LX + rt - 3, LT + 3), (LX + rb - 4, LB - 2)])), chatter=0)
    # two black bands; shading on the right side as vertical ridges left standing
    for (fa, fb) in ((0.22, 0.38), (0.58, 0.74)):
        ya, yb = LB - th * fa, LB - th * fb
        wa, wb = rb + (rt - rb) * fa, rb + (rt - rb) * fb
        L.leave(L.poly(P([(LX - wa, ya), (LX - wb, yb), (LX + wb, yb), (LX + wa, ya)])))
    for k in range(4):
        f = 0.35 + 0.17 * k
        L.gouge(P([(LX + rb * f, LB - 4), (LX + rt * f, LT + 6)]), S(1.8 + 0.4 * k), 'v', cut=False, taper=(0.1, 0.1))
    # gallery, lantern, dome
    L.leave(L.poly(P([(LX - rt - 9, LT + 2), (LX + rt + 9, LT + 2), (LX + rt + 9, LT - 5), (LX - rt - 9, LT - 5)])))
    for xx in np.linspace(LX - rt - 7, LX + rt + 7, 7):
        L.gouge(P([(xx, LT - 5), (xx, LT - 15)]), S(1.6), 'knife', cut=False, smooth=False)
    L.gouge(P([(LX - rt - 9, LT - 15), (LX + rt + 9, LT - 15)]), S(1.8), 'knife', cut=False, smooth=False)
    lan = P([(LX - 11, LT - 5), (LX + 11, LT - 5), (LX + 11, LT - 30), (LX - 11, LT - 30)])
    L.outline(L.poly(lan), S(2.4)); L.leave(L.poly(lan))
    glass = P([(LX - 8, LT - 8), (LX + 8, LT - 8), (LX + 8, LT - 27), (LX - 8, LT - 27)])
    L.clear(L.poly(glass), chatter=0)
    if not day:
        L.leave(L.poly(P([(LX - 9, LT - 7), (LX + 9, LT - 7), (LX + 9, LT - 28), (LX - 9, LT - 28)])), on=col)
    L.gouge(P([(LX, LT - 8), (LX, LT - 27)]), S(2.0), 'knife', cut=False, smooth=False)
    dome = [(LX - 14, LT - 30), (LX - 8, LT - 40), (LX, LT - 44), (LX + 8, LT - 40), (LX + 14, LT - 30)]
    L.outline(L.poly(P(dome)), S(2.4)); L.leave(L.poly(P(dome)))
    L.gouge(P([(LX, LT - 44), (LX, LT - 56)]), S(2.2), 'knife', cut=False, smooth=False)
    # keeper's cottage at its foot
    kx = LX + 30
    kh = [(kx, LB + 2), (kx, LB - 30), (kx + 28, LB - 50), (kx + 56, LB - 30), (kx + 56, LB + 2)]
    km = L.poly(P(kh)); L.outline(km, S(2.6)); L.leave(km)
    L.clear(L.poly(rect(kx + 20, LB - 22, kx + 34, LB - 8)), chatter=0)
    if not day:
        L.leave(L.poly(rect(kx + 19, LB - 23, kx + 35, LB - 7)), on=col)
    st('lighthouse')
    if not day:
        # beams: two long fans of cuts from the lantern into the dusk sky, printed in the colour
        for ang, ln in ((198, 640), (-14, 560)):
            for j in range(9):
                a = np.radians(ang + (j - 4) * 0.9)
                x0, y0 = LX + np.cos(a) * 26, LT - 18 + np.sin(a) * 26
                L_ = ln * (1 - abs(j - 4) * 0.07) * rng.uniform(0.9, 1.05)
                pts = P([(x0, y0), (x0 + np.cos(a) * L_, y0 + np.sin(a) * L_)])
                L.gouge(pts, S(3.4 - abs(j - 4) * 0.3), 'v', taper=(0.04, 0.85), smooth=False)
                L.gouge(pts, S(4.2 - abs(j - 4) * 0.3), 'v', cut=False, on=col, taper=(0.04, 0.85), smooth=False)
        st('beams')

    # ---------------------------------------------------------------- surf at the cliff foot, its reflection
    yy = np.arange(CH)[:, None].astype(np.float32)
    bline = S.y(BASE)
    refl = np.flipud(cm)                                   # the cliff mirrored about its foot
    shift_px = int(round(2 * bline - (CH - 1)))
    rm = np.zeros_like(cm)
    if shift_px >= 0:
        rm[shift_px:] = refl[:CH - shift_px]
    else:
        rm[:CH + shift_px] = refl[-shift_px:]
    rm = rm * (yy > bline + S(8)) * np.clip(1 - (yy - bline) / S(170), 0, 1) ** 0.6
    L.leave((rm > 0.35).astype(np.float32))
    L.hatch(P([(760, BASE), (X1, BASE), (X1, BASE + 190), (760, BASE + 190)]), angle=0, spacing=S(6), width=S(2.6),
            dash=(S(40), S(260)), gap=(S(6), S(36)), cut=True,
            density=d.fn(lambda x, y: np.clip(0.4 + (y - BASE) / 160, 0, 1)))
    for _ in range(int(70 * max(1.0, (X1 - 760) / 1190))):
        x = rng.uniform(770, X1); y = np.interp(x, bx[::-1], by[::-1]) + rng.uniform(-6, 16)
        ln = rng.uniform(16, 46)
        L.gouge(P([(x, y), (x + ln * 0.5, y - 5), (x + ln, y + 1)]), S(rng.uniform(3, 6)), 'u', taper=(0, 0.4))
    st('surf')

    # ---------------------------------------------------------------- sailing boats
    def boat(x, y, h, main_col=False, flip=1):
        k = h / 180
        hull = [(x - 110 * k * flip, y - 14 * k), (x + 120 * k * flip, y - 16 * k), (x + 96 * k * flip, y + 10 * k),
                (x - 86 * k * flip, y + 10 * k)]
        mast = L.stroke(P([(x + 6 * k * flip, y - 12 * k), (x + 6 * k * flip, y - h)]), S(max(2.0, 4.2 * k)), 'knife')
        mainsail = [(x + 12 * k * flip, y - h + 8 * k), (x + 12 * k * flip, y - 22 * k), (x + 104 * k * flip, y - 22 * k),
                    (x + 60 * k * flip, y - h * 0.5)]
        jib = [(x, y - h + 14 * k), (x - 96 * k * flip, y - 22 * k), (x - 4 * k * flip, y - 22 * k)]
        hm = L.mask_of([np.array(P(hull), np.float32), mast])
        sm = L.poly(P(spline(mainsail + [mainsail[0]], 6).tolist())); jm = L.poly(P(jib))
        L.clear(np.maximum(sm, jm), chatter=0)
        L.outline(np.maximum(sm, jm), S(max(1.6, 2.6 * k)), cut=False)       # black edge on the white sea
        if main_col:
            L.leave(sm, on=col)
        for f in (0.3, 0.55, 0.78):                                           # seams on the mainsail
            ya = y - 22 * k - (h - 30 * k) * f
            L.gouge(P([(x + 12 * k * flip, ya), (x + (104 - 70 * f) * k * flip, ya + 8 * k)]), S(max(1.2, 1.8 * k)),
                    'v', cut=False, region=sm)
        L.outline(hm, S(max(1.6, 2.4 * k)))
        L.leave(hm)
        L.gouge(P([(x - 96 * k * flip, y - 8 * k), (x + 104 * k * flip, y - 10 * k)]), S(max(1.2, 1.6 * k)), 'v')
        for j, yy_ in enumerate((14, 24, 36)):                               # broken reflection of the hull
            w = (100 - 24 * j) * k
            L.gouge(P([(x - w, y + yy_ * k), (x + w * 0.9, y + yy_ * k + 1)]), S(max(1.6, (4.0 - j * 0.7) * k * 1.3)),
                    'brush', end=S(1.5), cut=False)

    boat(700, 640, 78, flip=-1)
    st('boat')
    boat(180, 724, 120)
    st('boat')
    boat(450, 870, 210, main_col=True)
    st('boat')

    # ---------------------------------------------------------------- gulls
    gulls = [(640, 250, 1.2), (735, 300, 0.9), (820, 228, 0.8), (930, 330, 0.7), (580, 360, 0.75), (1160, 250, 0.9)]
    for (gx_, gy_, sc) in gulls:
        k = sc * 1.5
        for side in (-1, 1):
            pts = [(gx_, gy_), (gx_ + side * 10 * k, gy_ - 9 * k), (gx_ + side * 20 * k, gy_ - 6 * k), (gx_ + side * 30 * k, gy_ + 2 * k)]
            L.gouge(P(spline(pts, 6)), S((3.6 if day else 4.4) * max(k / 1.4, 0.75)), 'v', cut=not day, smooth=False,
                    taper=(0.15, 0.6))
    # two gulls low over the sea: black, left standing
    for (gx_, gy_, sc) in [(300, 640, 0.9), (360, 668, 0.7)]:
        k = sc * 1.5
        for side in (-1, 1):
            pts = [(gx_, gy_), (gx_ + side * 10 * k, gy_ - 9 * k), (gx_ + side * 20 * k, gy_ - 6 * k), (gx_ + side * 30 * k, gy_ + 2 * k)]
            L.gouge(P(spline(pts, 6)), S(4.0 * k / 1.4), 'v', cut=False, smooth=False, taper=(0.15, 0.6))
    st('gulls')

    # ---------------------------------------------------------------- foreground rocks in the surf (bottom right)
    rocks = [(1560, 1010, 150, 70), (1760, 975, 210, 110), (1950, 1000, 180, 120), (1420, 1060, 110, 50)]
    for (cx, cy, rx, ry) in rocks:
        t = np.linspace(np.pi, 2 * np.pi, 24)
        wob = 1 + 0.12 * fbm1d(24, 5, 3, int(rng.integers(1 << 30)))
        pts = [(cx + np.cos(a) * rx * w, cy + np.sin(a) * ry * w) for a, w in zip(t, wob)]
        pts += [(cx + rx, max(cy + 40, Y1 + 10)), (cx - rx, max(cy + 40, Y1 + 10))]
        rmk = L.poly(P(pts))
        L.outline(rmk, S(3.0))
        L.leave(rmk)
        L.hatch(P(pts), angle=-30, spacing=S(8), width=S(2.4), dash=(S(14), S(50)), gap=(S(8), S(30)), cut=True,
                density=d.fn(lambda x, y, cx=cx, cy=cy, ry=ry: np.clip(0.75 - (y - (cy - ry)) / (ry * 1.4), 0, 0.8)))
        for _ in range(9):                                                   # foam breaking round it
            a = rng.uniform(np.pi * 1.05, np.pi * 1.95)
            fx_, fy_ = cx + np.cos(a) * rx * 1.06, cy + np.sin(a) * ry * 1.04 + 30
            if fy_ > cy + 10: continue
            L.gouge(P([(fx_ - 20, fy_ + 4), (fx_, fy_ - 3), (fx_ + 22, fy_ + 5)]), S(4.5), 'u', taper=(0, 0.4))
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
