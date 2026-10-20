"""Coastal village on a cliff, lighthouse, sailing boats, gulls — Ink wash (水墨),
painted with vendor lib/inkpaint.py `Painting`.

python scripts/scenes/inkwash_coast.py out.png [W H [colourway [bleed]]]
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from PIL import Image, ImageDraw

import drawkit
from drawkit import Scaler, seed_all, save_png
from inkpaint import spline, curve, blur, fbm1d
from inkwash_kit import (Ink, conifer, any_tree, bird, fill_poly, ink_mass, cun, dian, ridge_accent, broad_stroke,
                         wash_field, water_dashes, STYLE, COLOURWAYS)

LIB = "inkpaint"
GROUPS = ("all",)
HORIZON = 600


def paint(W=1920, H=1080, seed=1, colourway="BlackInk", bleed=0.0, include=None,
          stages_dir=None, dense_stages=False):
    seed_all(seed)
    S = Scaler(W, H, bleed)
    s = S.s
    p = Ink(S, seed=seed, colourway=colourway, stages_dir=stages_dir, dense=dense_stages)
    YY, XX, YD, XD = p.YY, p.XX, p.YD, p.XD
    CW, CH = S.W, S.H
    xd = XD[0]
    hz = S.y(HORIZON)
    hzi = int(round(hz))
    p.setup_paper()
    p.snap('paper', dense=False)

    rng = p.begin('all', include is None or 'all' in include)
    if not p.layer['live']:
        p.end()
        return p.finish()

    # ---------------------------------------------------------------- sky: wash darker high up, a low sun
    SUNX, SUNY = 1480, 300
    # a pale grey wash brushed along the top, left to dissolve unevenly; the rest is bare paper
    yl = S.y(105) + fbm1d(CW, S(260), 4, p.sd()) * S(60) + fbm1d(CW, S(60), 3, p.sd()) * S(12)
    y1 = int(min(CH, yl.max() + S(40)))
    wash_field(p, 0, y1, 0, CW, yl[None, :] - YY[:y1], 0.09, S(70), pool=0.0)
    # dusk: a very pale vermilion wash laid wet across the lower right sky, ragged at the top
    yt = S.y(330) + fbm1d(CW, S(300), 4, p.sd()) * S(70) + np.clip((xd - SUNX) / 800, -1, 1) ** 2 * S(90)
    y0 = int(max(0, yt.min() - S(30)))
    f = np.minimum(YY[y0:hzi + 1] - yt[None, :], (hz - YY[y0:hzi + 1]) * 3)
    Rk = np.zeros_like(p.R)
    wash_field(p, y0, hzi + 1, 0, CW, f, 1.0, S(110), pool=0.2, buf=Rk)
    p.over(p.R, Rk * (0.13 * (0.35 + 0.65 * np.exp(-((xd - SUNX) / 650) ** 2)))[None, :])
    del Rk
    # a pale, watery sun: one round touch of thin accent ink
    p.wet_dot(S.x(SUNX), S.y(SUNY), S(34), 0.24, squash=1.03, red=True, irr=0.25)
    # a few thin wet cloud strokes
    for (cx, cy, ln, th, dens) in [(600, 150, 460, 20, 0.07), (1350, 205, 380, 14, 0.06), (1780, 122, 360, 18, 0.07)]:
        u0 = rng.uniform(-1.0, -0.8)
        for k in range(int(rng.integers(1, 3))):
            u1 = min(1.0, u0 + rng.uniform(0.8, 1.9))
            us = np.linspace(u0, u1, 9)
            sag = rng.uniform(4, 14); tilt = rng.uniform(-8, 8)
            pts = [(S.x(cx + ln * u), S.y(cy + sag * np.sin(u * 2.4) + tilt * u)) for u in us]
            broad_stroke(p, pts, S(th) * rng.uniform(0.7, 1.3), dens * rng.uniform(0.8, 1.25), dry=rng.uniform(0.45, 0.8),
                         taper=(rng.uniform(0.25, 0.5), rng.uniform(0.3, 0.6)), pool=rng.uniform(0.15, 0.6), hair=0.9)
            u0 = u1 + rng.uniform(0.06, 0.2)
            if u0 >= 0.9:
                break
    p.snap('sky')

    # ---------------------------------------------------------------- distant headlands on the right
    isl = p.ridge(S.y(HORIZON + 4), peaks=[(S.x(1380), S(28), S(110)), (S.x(1660), S(62), S(150)), (S.x(1900), S(92), S(170)),
                                         (S.x(2150), S(70), S(160))],
                  rough=S(6), rough_scale=S(90), seed=seed + 11)
    Dh = np.zeros_like(p.D)
    ink_mass(p, isl, dens=0.30, reach=S(50), glazes=2, soft=1.4, pool=0.5, blooms=1, dry=0.2, floor=hz,
             mist=(S.y(594), S(6)), buf=Dh)
    np.multiply(p.D, 1 - 0.97 * np.clip((YY - isl[None, :]) / S(3), 0, 1) * (YY < hz), out=p.D)
    p.over(p.D, Dh); del Dh
    np.multiply(p.D, 1 - np.clip((YY - hz) / S(2), 0, 1), out=p.D)
    np.multiply(p.R, 1 - np.clip((YY - isl[None, :]) / S(2), 0, 1) * (YY < hz), out=p.R)
    p.snap('far headlands')

    # ---------------------------------------------------------------- sea: mostly bare paper
    # a pale wash pulled across the sea, darker toward the viewer, its top edge broken
    for (yc, dens, soft) in [(820, 0.07, 90), (960, 0.09, 70)]:
        top = S.y(yc) + fbm1d(CW, S(260), 4, p.sd()) * S(30)
        y0 = int(max(hzi, top.min() - S(40)))
        wash_field(p, y0, CH, 0, CW, YY[y0:CH] - top[None, :], dens, S(soft), pool=0.3)
    # a soft band under the far headlands (their reflection, simplified to one pale pull)
    for k in range(4):
        x0 = rng.uniform(1250, 1800); x1 = min(2100, x0 + rng.uniform(150, 420))
        y = HORIZON + rng.uniform(3, 14)
        broad_stroke(p, [S.pt(x_, y + rng.normal(0, 1)) for x_ in np.linspace(x0, x1, 5)], S(rng.uniform(4, 9)),
                     rng.uniform(0.06, 0.12), dry=rng.uniform(0.4, 0.8), taper=(0.3, 0.4), pool=0.3)
    # swell marks in loose clusters, longer and heavier toward the viewer
    water_dashes(p, S.y(HORIZON + 8), S.y(1075), S.x(860), S.x(S.X1), clusters=11, ink=0.32,
                 avoid=[(S.x(1240), S.y(760), S.x(1440), S.y(900))])
    water_dashes(p, S.y(HORIZON + 6), S.y(760), S.x(1000), S.x(S.X1), clusters=5, ink=0.2, persp=(0.35, 0.8))
    # the sun's path: a few broken pale strokes under the sun
    y = hz + S(12)
    while y < hz + S(230):
        f = (y - hz) / S(230)
        half = S(34) * rng.uniform(0.6, 1.7) * (1.2 - 0.6 * f)
        cx = S.x(SUNX) + rng.normal(0, S(6))
        if rng.random() < 0.8:
            p.stroke(spline([(cx - half, y), (cx + rng.normal(0, S(4)), y + rng.normal(0, S(0.8))), (cx + half, y)], 8),
                     S(rng.uniform(1.0, 2.2)), 0.32 * (1 - 0.7 * f) * rng.uniform(0.6, 1.1), dry=rng.uniform(0.4, 0.8),
                     taper=(0.3, 0.3), red=True)
        y += S(rng.uniform(8, 26))
    p.snap('sea')

    # ---------------------------------------------------------------- distant sailing boats (behind the cliff)
    def sailboat(x, yw, L, ink=0.8, flip=1):
        """hull length L (design px) floating at design waterline yw"""
        X, Y = S.x(x), S.y(yw)
        l = S(L)
        mast_x = X + flip * l * 0.05
        top = Y - l * 1.05
        # mainsail: pale wash triangle, dark leech and luff
        boom_end = (mast_x - flip * l * 0.42, Y - l * 0.12)
        fill_poly(p, [(mast_x, top + l * 0.04), (mast_x, Y - l * 0.12), boom_end,
                      (mast_x - flip * l * 0.22, Y - l * 0.55)], 0.16 * ink, rough=0.4, soft=S(1.2))
        p.stroke(spline([(mast_x, top + l * 0.04), (mast_x - flip * l * 0.24, Y - l * 0.52), boom_end], 10),
                 S(1.6) * l / S(100) + S(0.6), ink * 0.55, dry=0.55, taper=(0.1, 0.3))
        # jib, lighter
        fill_poly(p, [(mast_x + flip * l * 0.02, top + l * 0.12), (X + flip * l * 0.46, Y - l * 0.1),
                      (mast_x + flip * l * 0.04, Y - l * 0.12)], 0.09 * ink, rough=0.4, soft=S(1.2))
        p.stroke([(mast_x + flip * l * 0.02, top + l * 0.12), (X + flip * l * 0.46, Y - l * 0.1)],
                 S(1.0) + S(0.6) * l / S(100), ink * 0.4, dry=0.6, taper=(0.2, 0.2))
        p.stroke([(mast_x, Y - l * 0.04), (mast_x, top)], S(1.0) + S(1.0) * l / S(100), ink * 0.85, dry=0.3, taper=(0.1, 0.4))
        # hull
        p.stroke(spline([(X - flip * l * 0.5, Y - l * 0.1), (X - flip * l * 0.3, Y), (X + flip * l * 0.3, Y + l * 0.01),
                         (X + flip * l * 0.52, Y - l * 0.13)], 12), S(2.5) + S(3.5) * l / S(100), ink, dry=0.25, taper=(0.1, 0.15))
        # broken reflection
        for k in range(3):
            yy = Y + l * (0.08 + 0.07 * k)
            p.stroke(spline([(X - l * (0.4 - 0.08 * k), yy), (X + rng.normal(0, l * 0.04), yy + l * 0.015),
                             (X + l * (0.4 - 0.1 * k), yy)], 8), S(1.2) + S(1.2) * l / S(100), ink * (0.28 - 0.07 * k), dry=0.6,
                     taper=(0.3, 0.3))
        p.stroke([(mast_x, Y + l * 0.12), (mast_x + rng.normal(0, l * 0.02), Y + l * 0.55)], S(1.4) * l / S(100) + S(0.5),
                 ink * 0.18, dry=0.7, taper=(0.2, 0.6))

    sailboat(1590, 632, 34, 0.55, flip=-1)
    sailboat(1150, 648, 46, 0.62)
    p.snap('distant sails')

    # ---------------------------------------------------------------- the cliff headland (left), village plateau
    ctrl = [(-400, 236), (-150, 238), (0, 246), (120, 258), (260, 290), (420, 314), (560, 328), (700, 346),
            (800, 360), (858, 372), (880, 400), (902, 470), (925, 560), (950, 640), (975, 700), (1000, 745),
            (1030, 790), (1060, 830), (1080, 1400)]
    cx_, cy_ = np.array(ctrl, np.float32).T
    cliff_d = np.interp(xd, cx_, cy_)
    rough = fbm1d(CW, S(60), 5, seed + 21) * np.clip((xd - 840) / 40, 0.15, 1.0)
    cliff = S.y(cliff_d) + S(14) * rough
    cliff[xd > 1080] = CH + 400
    # the headland is painted on its own sheet and cut off at its foot, so the sea runs in below it
    D_bg, R_bg = p.D, p.R
    p.D, p.R = np.zeros_like(D_bg), np.zeros_like(R_bg)
    ink_mass(p, cliff, dens=0.72, reach=S(230), glazes=4, soft=0.9, pool=0.55, blooms=3, dry=0.35,
             mist=(S.y(770), S(34)))
    # axe-cut texture strokes down the cliff face and under the plateau lip
    for k in range(110):
        face = True
        x = rng.uniform(840, 1020) if face else rng.uniform(-60, 840)
        top = float(np.interp(x, cx_, cy_)) + (rng.uniform(6, 30) if face else rng.uniform(50, 220))
        if top > 760:
            continue
        ln = rng.uniform(40, 120) * (1.3 if face else 0.8)
        dx = (rng.uniform(-14, 4) if face else rng.uniform(-60, -15))
        X, Y = S.x(x), S.y(top)
        p.stroke(spline([(X, Y), (X + S(dx) * 0.4 + rng.normal(0, S(3)), Y + S(ln) * 0.5), (X + S(dx), Y + S(ln))], 8),
                 S(rng.uniform(2.0, 4.0)), rng.uniform(0.18, 0.34) * (1.0 if face else 0.55), dry=0.65, taper=(0.1, 0.5))
    ridge_accent(p, cliff, S.x(-200), S.x(860), ink=0.3, width=2.0, coverage=0.4)
    for k in range(20):     # long, light hemp-fibre strokes following the slope of the headland
        x = rng.uniform(-150, 800)
        top = float(np.interp(x, cx_, cy_)) + rng.uniform(40, 330)
        ln = rng.uniform(160, 380)
        sl = rng.uniform(0.25, 0.6)
        X, Y = S.x(x), S.y(top)
        p.stroke(spline([(X, Y), (X - S(ln) * 0.45, Y + S(ln) * sl * 0.5 + rng.normal(0, S(8))), (X - S(ln), Y + S(ln) * sl)], 10),
                 S(rng.uniform(1.6, 3.0)), rng.uniform(0.10, 0.18), dry=0.72, taper=(0.3, 0.5), jitter=1.0)
    dian(p, cliff, S.x(-60), S.x(850), clusters=7, ink=0.6, depth=16)
    foot = S.y(800 + 12 * fbm1d(CW, S(80), 4, seed + 23))
    cut = 1 - np.clip((YY - foot[None, :]) / S(10), 0, 1)
    occ = 0.97 * np.clip((YY - cliff[None, :] + 1) / 6, 0, 1) * cut
    p.D = Ink._merge(D_bg, occ, p.D * cut)
    p.R = Ink._merge(R_bg, np.clip((YY - cliff[None, :]) / S(3), 0, 1) * cut, p.R * cut)
    del D_bg, R_bg
    foam = np.zeros_like(p.D)
    for k in range(30):
        x = rng.uniform(150, 1000)
        p.blob(S.x(x), foot[int(np.clip(S.x(x), 0, CW - 1))] - S(2), S(rng.uniform(20, 50)), S(rng.uniform(2, 4)), 0.8,
               buf=foam, rough=0.6)
    np.multiply(p.D, 1 - 0.7 * np.clip(foam, 0, 1), out=p.D)
    p.snap('cliff')

    # ---------------------------------------------------------------- village on the plateau
    def house(x, w, h, roof_h, ink=0.85, flip=1, back=0.0):
        """pitched-roof cottage standing on the plateau at design x (back = raised further up the slope)"""
        base = 0.5 * (float(np.interp(x, cx_, cy_)) + float(np.interp(x + w, cx_, cy_))) + 3 - back
        X0, X1 = S.x(x), S.x(x + w)
        Yb, Yw = S.y(base), S.y(base - h)
        Yr = S.y(base - h - roof_h)
        ridge_x = S.x(x + w * (0.5 + 0.08 * flip))
        # lift a wall out of the cliff wash: clean at the eaves, dissolving into the slope below
        wall = [(X0, Yb + S(4)), (X0, Yw), (X1, Yw), (X1, Yb + S(4))]
        m = fill_poly(p, wall, 0.0, rough=0.0, soft=S(0.6))
        if m is not None:
            x0, y0 = int(max(0, min(X0, X1) - 6)), int(max(0, Yw - 6))
            hh, ww = m.shape
            ramp = np.clip(1 - (np.arange(hh, dtype=np.float32)[:, None] + y0 - Yw) / max(1.0, Yb - Yw), 0, 1)
            g = rng.random((4, 5)).astype(np.float32)
            nz = np.asarray(Image.fromarray(g).resize((ww, hh), Image.BICUBIC), np.float32)
            lift = m * (0.1 + 0.85 * ramp ** 0.6) * (0.85 + 0.3 * nz)
            sl = p.D[y0:y0 + hh, x0:x0 + ww]
            np.multiply(sl, 1 - np.clip(lift, 0, 0.95), out=sl)
        sh = (X1 - (X1 - X0) * 0.38, X1) if flip > 0 else (X0, X0 + (X1 - X0) * 0.38)
        fill_poly(p, [(sh[0], Yb), (sh[0], Yw), (sh[1], Yw), (sh[1], Yb)], 0.2 * ink, rough=0.5, soft=S(1.5))
        # roof: one loaded dry-brush stroke over a dark broken fill
        eave = S(rng.uniform(4, 7))
        roof = [(X0 - eave, Yw + S(1)), (ridge_x, Yr), (X1 + eave, Yw + S(1))]
        fill_poly(p, roof, -0.9, rough=0.0, soft=S(0.6))
        fill_poly(p, roof, 0.55 * ink, rough=0.6, soft=S(1.0))
        p.stroke(spline([(X0 - eave, Yw + S(2)), ((X0 + ridge_x) / 2, (Yw + Yr) / 2 - S(1)), (ridge_x, Yr),
                         ((X1 + ridge_x) / 2 + S(1), (Yw + Yr) / 2), (X1 + eave, Yw + S(2))], 6),
                 S(rng.uniform(2.6, 3.6)), ink, dry=0.5, taper=(0.05, 0.25), jitter=0.9)
        # one broken wall edge on the shadow side, a dark door or window dab
        ex = X1 if flip > 0 else X0
        p.stroke([(ex, Yw + S(3)), (ex + rng.normal(0, S(0.6)), Yb - S(2))], S(1.4), ink * 0.5, dry=0.7, taper=(0.1, 0.6))
        for i in range(1):
            wx = X0 + (X1 - X0) * (rng.uniform(0.2, 0.35) if flip > 0 else rng.uniform(0.65, 0.8))
            wy0 = Yw + (Yb - Yw) * rng.uniform(0.25, 0.4)
            p.stroke([(wx, wy0), (wx + rng.normal(0, S(0.3)), wy0 + (Yb - Yw) * rng.uniform(0.18, 0.4))],
                     S(rng.uniform(2.4, 3.4)), ink * 0.7, dry=0.35, taper=(0.15, 0.3))
        # the ground it stands on: a low dark brushy line of shrubs
        gl = [(X0 - S(6), Yb + S(1)), ((X0 + X1) / 2, Yb + S(rng.uniform(-1, 2))), (X1 + S(6), Yb + S(1))]
        p.stroke(spline(gl, 6), S(rng.uniform(3, 4.5)), ink * 0.65, dry=0.6, taper=(0.2, 0.3), jitter=1.2)
        if rng.random() < 0.5:
            chx = ridge_x + flip * (X1 - X0) * 0.22
            p.stroke([(chx, Yr + (Yw - Yr) * 0.45), (chx, Yr - S(3))], S(3.2), ink * 0.8, dry=0.4, taper=(0.1, 0.2))

    # back row first (further up the slope, paler and smaller), then the front row, then trees between
    for (x, w, h, rh, fl) in [(95, 40, 22, 18, 1), (338, 44, 24, 20, -1), (610, 40, 22, 18, 1)]:
        house(x, w, h, rh, 0.5, fl, back=12)
    for (x, w, h, rh, fl) in [(18, 56, 32, 26, -1), (232, 62, 34, 28, 1), (292, 46, 28, 24, -1), (500, 58, 32, 26, 1),
                              (556, 44, 28, 22, -1), (692, 52, 30, 24, 1)]:
        house(x, w, h, rh, 0.82, fl)
        p.snap('cottage')
    for (x, hgt, ink) in [(146, 84, 0.7), (196, 58, 0.55), (392, 74, 0.65), (440, 96, 0.75), (470, 60, 0.55),
                          (655, 70, 0.62), (760, 58, 0.55)]:
        base = float(np.interp(x, cx_, cy_)) + 6
        any_tree(p, S.x(x + rng.normal(0, 6)), S.y(base - hgt * rng.uniform(0.85, 1.15)), S.y(base), ink, wind=-0.2)
    p.snap('village trees')

    # ---------------------------------------------------------------- lighthouse on the cliff tip
    LX, LB = 815, float(np.interp(815, cx_, cy_)) + 6
    th, bw, tw = 150, 30, 19
    X, Yb = S.x(LX), S.y(LB)
    pts = [(X - S(bw / 2), Yb), (X - S(tw / 2), Yb - S(th)), (X + S(tw / 2), Yb - S(th)), (X + S(bw / 2), Yb)]
    fill_poly(p, pts, -0.95, rough=0.0, soft=S(0.6))
    fill_poly(p, [(X + S(bw / 2) * 0.25, Yb), (X + S(tw / 2) * 0.25, Yb - S(th)), (X + S(tw / 2), Yb - S(th)),
                  (X + S(bw / 2), Yb)], 0.20, rough=0.3, soft=S(1))
    for (a, b) in [(0.18, 0.32), (0.55, 0.69)]:                # two dark bands
        ya, yb_ = Yb - S(th) * a, Yb - S(th) * b
        wa, wb = S(bw / 2 + (tw - bw) / 2 * a), S(bw / 2 + (tw - bw) / 2 * b)
        fill_poly(p, [(X - wa, ya), (X - wb, yb_), (X + wb, yb_), (X + wa, ya)], 0.72, rough=0.35, soft=S(0.8))
    p.stroke([(X - S(bw / 2), Yb), (X - S(tw / 2), Yb - S(th))], S(1.8), 0.7, dry=0.45, taper=(0.1, 0.2))
    p.stroke([(X + S(bw / 2), Yb), (X + S(tw / 2), Yb - S(th))], S(2.2), 0.8, dry=0.4, taper=(0.1, 0.2))
    # gallery, lantern room, cap
    Yg = Yb - S(th)
    p.stroke([(X - S(tw / 2 + 6), Yg), (X + S(tw / 2 + 6), Yg)], S(3.2), 0.85, dry=0.2, taper=(0.1, 0.1))
    fill_poly(p, [(X - S(7), Yg - S(2)), (X - S(7), Yg - S(18)), (X + S(7), Yg - S(18)), (X + S(7), Yg - S(2))], -0.95, rough=0, soft=S(0.5))
    for dx in (-7, 0, 7):
        p.stroke([(X + S(dx), Yg - S(2)), (X + S(dx), Yg - S(18))], S(1.3), 0.7, dry=0.2, taper=(0.1, 0.1))
    fill_poly(p, [(X - S(10), Yg - S(18)), (X, Yg - S(30)), (X + S(10), Yg - S(18))], 0.85, rough=0.2, soft=S(0.7))
    p.stroke([(X, Yg - S(30)), (X, Yg - S(37))], S(1.4), 0.8, dry=0.2)
    # the lamp: a warm accent glow and two faint beams lifted out of the sky wash
    lamp = (X, Yg - S(10))
    d = np.hypot(XX - lamp[0], YY - lamp[1])
    p.wet_dot(lamp[0], lamp[1], S(5), 0.6, red=True, irr=0.5)
    p.over(p.R, 0.10 * np.exp(-(d / S(40)) ** 2))
    p.snap('lighthouse')

    # leaning pine on the cliff edge beside the lighthouse
    conifer(p, S.x(868), S.y(296), S.y(392), 0.85, wind=0.9, halo=1.0)
    p.snap('cliff pine')

    # ---------------------------------------------------------------- surf at the cliff foot
    foam = np.zeros_like(p.D)
    for k in range(34):
        y = rng.uniform(690, 800)
        xc = float(np.interp(y, cy_[9:16], cx_[9:16])) + rng.uniform(-10, 50)
        p.blob(S.x(xc), S.y(y), S(rng.uniform(14, 42)), S(rng.uniform(2.5, 6)), 0.9, buf=foam, rough=0.6)
    np.multiply(p.D, 1 - 0.85 * np.clip(foam, 0, 1), out=p.D)
    for k in range(14):                       # broken dry strokes riding the swell into the rocks
        y = rng.uniform(705, 800)
        xc = float(np.interp(y, cy_[9:16], cx_[9:16])) + rng.uniform(10, 70)
        X, Y = S.x(xc), S.y(y)
        ln = S(rng.uniform(30, 80))
        p.stroke(spline([(X, Y), (X + ln * 0.5, Y - S(3)), (X + ln, Y + S(1))], 8), S(1.6), 0.35, dry=0.65, taper=(0.2, 0.4))
    p.snap('surf')

    # ---------------------------------------------------------------- foreground rocks bottom-left
    rock_ctrl = [(-400, 860), (0, 880), (160, 900), (330, 935), (480, 975), (620, 1020), (720, 1060), (800, 1110),
                 (870, 1190), (920, 1300), (950, 1500)]
    rx_, ry_ = np.array(rock_ctrl, np.float32).T
    rock = S.y(np.interp(xd, rx_, ry_)) + S(10) * fbm1d(CW, S(50), 5, seed + 31)
    rock[xd > 950] = CH + 400
    ink_mass(p, rock, dens=0.85, reach=S(160), glazes=4, soft=0.8, pool=0.6, blooms=2, dry=0.45)
    for k in range(40):
        x = rng.uniform(-60, 760)
        top = float(np.interp(x, rx_, ry_)) + rng.uniform(4, 60)
        X, Y = S.x(x), S.y(top)
        p.stroke(curve((X, Y), (X + S(rng.normal(-10, 8)), Y + S(rng.uniform(12, 60))), S(rng.normal(0, 6)), 10),
                 S(rng.uniform(1.5, 5)), rng.uniform(0.2, 0.42), dry=rng.uniform(0.55, 0.85), taper=(rng.uniform(0.05, 0.3), 0.5))
    for k in range(9):            # grass on the rocks: loose clumps of long and short blades
        x = rng.uniform(-20, 700)
        y = float(np.interp(x, rx_, ry_)) + 5
        for j in range(int(rng.integers(2, 9))):
            ln = rng.uniform(10, 46) * (2.0 if rng.random() < 0.25 else 1.0)
            a = rng.uniform(-1.1, 0.8)
            X, Y = S.x(x + rng.uniform(-8, 8)), S.y(y + rng.uniform(-2, 4))
            p.stroke(spline([(X, Y), (X + S(ln) * np.sin(a) * 0.4, Y - S(ln) * 0.55), (X + S(ln) * np.sin(a), Y - S(ln))], 6),
                     S(rng.uniform(1.0, 2.6)), rng.uniform(0.35, 0.75), dry=rng.uniform(0.25, 0.6), taper=(0.02, rng.uniform(0.6, 0.9)))
    p.snap('foreground rocks')

    sailboat(1330, 845, 118, 0.88)
    p.snap('sailboat')

    # ---------------------------------------------------------------- gulls
    for (gx, gy, sc) in [(1010, 330, 0.9), (1062, 304, 0.7), (1170, 368, 0.6), (1310, 428, 0.5), (930, 248, 1.05), (1236, 262, 0.45)]:
        bird(p, S.x(gx + rng.normal(0, 8)), S.y(gy + rng.normal(0, 6)), sc * s * rng.uniform(0.85, 1.15), ink=0.78)
    p.snap('gulls')

    p.end()
    return p.finish()


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else 'inkwash_coast.png'
    W = int(sys.argv[2]) if len(sys.argv) > 2 else 1920
    H = int(sys.argv[3]) if len(sys.argv) > 3 else 1080
    cw = sys.argv[4] if len(sys.argv) > 4 else "BlackInk"
    bl = float(sys.argv[5]) if len(sys.argv) > 5 else 0.0
    save_png(paint(W, H, colourway=cw, bleed=bl), out)
    print('saved', out)
