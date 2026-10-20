"""Forest path through tall trees, sun rays, a deer in the distance — Ink wash (水墨),
painted with vendor lib/inkpaint.py `Painting`.

python scripts/scenes/inkwash_forest.py out.png [W H [colourway [bleed]]]
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np

import drawkit
from drawkit import Scaler, seed_all, save_png
from inkpaint import spline, curve, blur, fbm1d
from inkwash_kit import (Ink, conifer, broad_stroke, wash_field, wet_patch, brush, fibre_bleed, vnz, sstep, STYLE,
                         COLOURWAYS)

LIB = "inkpaint"
GROUPS = ("all",)
VP = (1180, 610)          # where the path vanishes into the mist (off-centre, right of middle)


def paint(W=1920, H=1080, seed=1, colourway="BlackInk", bleed=0.0, include=None,
          stages_dir=None, dense_stages=False):
    seed_all(seed)
    S = Scaler(W, H, bleed)
    s = S.s
    p = Ink(S, seed=seed, colourway=colourway, stages_dir=stages_dir, dense=dense_stages)
    YY, XX, YD, XD = p.YY, p.XX, p.YD, p.XD
    CW, CH = S.W, S.H
    p.setup_paper()
    p.snap('paper', dense=False)

    rng = p.begin('all', include is None or 'all' in include)
    if not p.layer['live']:
        p.end()
        return p.finish()

    # ---------------------------------------------------------------- canopy and air: washes, light left as paper
    # the canopy: a wet wash hanging from the top edge, heavy at the left, thinning to bare paper
    # at the upper right where the light comes in
    yl = S.y(250) + fbm1d(CW, S(240), 4, p.sd()) * S(90) - np.clip((XD[0] - 900) / 700, 0, 1) ** 1.4 * S(330)
    y1 = int(min(CH, max(1, yl.max() + S(80))))
    wash_field(p, 0, y1, 0, CW, yl[None, :] - YY[:y1], 0.22, S(90), pool=0.3)
    yl2 = S.y(110) + fbm1d(CW, S(160), 4, p.sd()) * S(70) - np.clip((XD[0] - 700) / 600, 0, 1) ** 1.2 * S(260)
    y1 = int(min(CH, max(1, yl2.max() + S(60))))
    wash_field(p, 0, y1, 0, CW, yl2[None, :] - YY[:y1], 0.2, S(60), pool=0.45)
    # warm light: a very pale wash of the accent laid wet in the opening
    y1 = int(min(CH, S.y(520)))
    lf = S(330) - np.hypot((XX[:y1] - S.x(1480)) * 0.8, YY[:y1] - S.y(40))
    Rk = np.zeros_like(p.R)
    wash_field(p, 0, y1, 0, CW, lf, 1.0, S(160), pool=0.0, buf=Rk)
    p.over(p.R, 0.07 * Rk); del Rk
    p.snap('air')

    # ---------------------------------------------------------------- far forest: pale trees dissolving in mist
    far = []
    x = S.X0 - 40
    while x < S.X1 + 40:
        far.append(x)
        x += rng.choice([rng.uniform(14, 40), rng.uniform(50, 150)]) * (1.5 if x > 1300 else 1.0)
    for i, x in enumerate(far):
        base = 640 + rng.uniform(-14, 10)
        top = rng.uniform(150, 470)
        ink = rng.uniform(0.07, 0.22) * (0.6 if 1300 < x < 1800 else 1.0)
        if rng.random() < 0.6:
            conifer(p, S.x(x), S.y(top), S.y(base), ink, wind=rng.normal(0, 0.2), halo=0.0,
                    spread=rng.uniform(0.4, 0.75), bare=rng.uniform(0.08, 0.3), style=('mixed', 'brush')[int(rng.integers(2))])
        else:                                           # just a pale upright stroke: a trunk lost in the mist
            broad_stroke(p, [S.pt(x, base), S.pt(x + rng.normal(0, 8), (base + top) / 2), S.pt(x + rng.normal(0, 10), top)],
                         S(rng.uniform(4, 12)), ink * 0.9, dry=rng.uniform(0.3, 0.8), taper=(0.1, 0.6), pool=0.3,
                         grow=(1.0, rng.uniform(0.5, 0.9)), maxseg=12)
        if i % 12 == 11:
            p.snap('far trees')
    # mist swallowing their feet: paper reserved, its edge soft but ragged and crept into the fibre
    y0, y1 = int(max(0, S.y(450))), int(min(CH, S.y(740)))
    Ym, Xm = YY[y0:y1], XX[y0:y1]
    wob = fbm1d(CW, S(380), 3, p.sd())[None, :] * S(40)
    half = (S(30) + S(60) * np.clip(0.5 + fbm1d(CW, S(260), 3, p.sd()), 0, 1))[None, :]
    mz = vnz(rng, Ym, Xm, S(14), S(70), 4) * S(22) + vnz(rng, Ym, Xm, S(3), S(7), 2) * S(2.5)
    m = np.clip((half - np.abs(Ym - S.y(605) - wob) + mz + fibre_bleed(p, y0, y1, 0, CW, S(8))) / S(5), 0, 1)
    np.multiply(p.D[y0:y1], 1 - 0.92 * m, out=p.D[y0:y1])
    p.snap('far mist')

    # ---------------------------------------------------------------- the path and the forest floor
    # path centre line and half-width (design px) as functions of y, from the bottom up to the vanishing point;
    # it swings in from the lower left and turns right into the mist
    yk = np.array([VP[1], 660, 760, 900, 1080, 1400], np.float32)
    ck = np.array([VP[0], 1160, 1090, 960, 830, 700], np.float32)
    wk = np.array([10, 26, 64, 140, 250, 400], np.float32)
    sp = spline(np.stack([ck, yk], 1), 24)                 # smooth S-curve, monotone in y
    ws = spline(np.stack([wk, yk], 1), 24)
    yk, ck = sp[:, 1].copy(), sp[:, 0].copy()
    wk = np.interp(yk, ws[:, 1], ws[:, 0])
    y0 = int(max(0, S.y(VP[1] - 30)))
    YDf, XDf = YD[y0:CH], XD[y0:CH]
    pc = np.interp(YDf, yk, ck)
    pw = np.interp(YDf, yk, wk) * (1 + 0.12 * vnz(rng, YY[y0:CH], XX[y0:CH], S(60), S(90), 2) * 0.5)
    outside = (np.abs(XDf - pc) - pw) * s                    # px outside the path edge (path = reserved paper)
    # the floor: pale washes laid either side of the path, the nearer ones deeper, edges left ragged
    g1 = S.y(VP[1] + 6) + fbm1d(CW, S(200), 3, p.sd())[None, :] * S(10)
    wash_field(p, y0, CH, 0, CW, np.minimum(YY[y0:CH] - g1, outside + S(4)), 0.12, S(30), pool=0.4)
    g2 = S.y(800) + fbm1d(CW, S(260), 4, p.sd())[None, :] * S(60)
    wash_field(p, y0, CH, 0, CW, np.minimum(YY[y0:CH] - g2, outside - S(10)), 0.14, S(60), pool=0.35)
    g3 = S.y(960) + fbm1d(CW, S(220), 4, p.sd())[None, :] * S(50)
    wash_field(p, y0, CH, 0, CW, np.minimum(YY[y0:CH] - g3, outside - S(30)), 0.12, S(50), pool=0.3)
    p.snap('path')
    # dry ruts and leaf strokes on the path, converging to the vanishing point
    for k in range(30):
        y = rng.uniform(VP[1] + 30, 1075)
        c = float(np.interp(y, yk, ck)); w = float(np.interp(y, yk, wk))
        x = c + rng.uniform(-0.7, 0.7) * w
        f = (y - VP[1]) / (1080 - VP[1])
        ln = rng.uniform(8, 60) * (0.3 + f)
        X, Y = S.x(x), S.y(y)
        brush(p, [(X, Y), (X + S(ln) * 0.5, Y + S(rng.normal(0, 1.2))), (X + S(ln), Y + S(rng.normal(0, 1.5)))],
              S((0.8 + 2.4 * f) * rng.uniform(0.6, 1.4)), (0.08 + 0.16 * f) * rng.uniform(0.6, 1.3), dry=rng.uniform(0.5, 0.85),
              taper=(rng.uniform(0.1, 0.4), 0.4), swell=rng.uniform(0.2, 0.7), maxseg=8)
    for k in range(34):      # faint dry strokes across the forest floor, flattening with distance
        y = rng.uniform(VP[1] + 15, 1070)
        c = float(np.interp(y, yk, ck)); w = float(np.interp(y, yk, wk))
        side = rng.choice([-1, 1])
        x = c + side * (w * 1.1 + rng.uniform(0, 900))
        f = (y - VP[1]) / (1080 - VP[1])
        ln = rng.uniform(25, 160) * (0.3 + f)
        X, Y = S.x(x), S.y(y)
        p.stroke(spline([(X, Y), (X + S(ln) / 2, Y - S(rng.uniform(0, 1 + 2 * f))), (X + S(ln), Y)], 6),
                 S((0.8 + 2 * f) * rng.uniform(0.6, 1.4)), (0.06 + 0.14 * f) * rng.uniform(0.6, 1.3),
                 dry=rng.uniform(0.5, 0.85), taper=(0.3, 0.4))
    p.snap('path marks')

    # ---------------------------------------------------------------- tall trees (trunks run out of frame)
    def tuft(gx, gy, size, ink):
        """grass: each tuft its own kind — a loose fan, blades all bent one way by the wind, one or
        two long crossing blades, a sprig, or a few moss dots with a tick"""
        kind = ['fan', 'lean', 'lean', 'pair', 'sprig', 'dots'][int(rng.integers(6))]
        if kind == 'dots':
            for j in range(int(rng.integers(2, 6))):
                p.wet_dot(gx + rng.normal(0, size * 0.4), gy - abs(rng.normal(0, size * 0.15)), S(rng.uniform(1.2, 2.6)) * (0.6 + size / S(40)),
                          ink * rng.uniform(0.6, 1.0), squash=rng.uniform(1.0, 2.2), rot=rng.uniform(-0.4, 0.4))
            return
        if kind == 'sprig':
            ln = size * rng.uniform(0.6, 1.3); a = rng.normal(0, 0.3)
            X2, Y2 = gx + ln * np.sin(a), gy - ln * np.cos(a)
            brush(p, [(gx, gy), ((gx + X2) / 2 + rng.normal(0, size * 0.08), (gy + Y2) / 2), (X2, Y2)], S(rng.uniform(1.2, 2.2)) * (0.6 + size / S(40)),
                  ink * rng.uniform(0.6, 1.0), dry=0.4, taper=(0.02, 0.8), swell=0.2, maxseg=8)
            for j in range(int(rng.integers(2, 5))):
                t_ = rng.uniform(0.3, 0.9); qx, qy = gx + (X2 - gx) * t_, gy + (Y2 - gy) * t_
                sd = rng.choice([-1, 1]); l2 = size * rng.uniform(0.15, 0.35)
                brush(p, [(qx, qy), (qx + sd * l2, qy - l2 * rng.uniform(0.2, 0.7))], S(rng.uniform(1.5, 3)) * (0.6 + size / S(40)),
                      ink * rng.uniform(0.5, 0.9), dry=0.3, taper=(0.05, 0.6), swell=0.5, maxseg=4)
            return
        nb = {'fan': int(rng.integers(3, 8)), 'lean': int(rng.integers(3, 7)), 'pair': int(rng.integers(1, 3))}[kind]
        wind = rng.uniform(0.3, 0.9) * rng.choice([-1, 1])
        for j in range(nb):
            if kind == 'fan':
                a = rng.uniform(-1.0, 1.0) * rng.uniform(0.4, 1.2)
            elif kind == 'lean':
                a = wind * 0.6 + rng.normal(0, 0.15)
            else:
                a = rng.uniform(-0.7, 0.7)
            ln = size * rng.uniform(0.35, 1.25) * (1.7 if kind == 'pair' else 1.0)
            curl = (wind * 0.5 if kind == 'lean' else rng.uniform(-0.5, 0.5))
            X = gx + rng.uniform(-0.6, 0.6) * size * 0.5
            brush(p, [(X, gy), (X + ln * np.sin(a) * 0.45, gy - ln * 0.55),
                      (X + ln * (np.sin(a) + curl * 0.6), gy - ln * (0.92 - abs(curl) * 0.3))],
                  S(rng.uniform(1.2, 3.2)) * (0.6 + size / S(40)), ink * rng.uniform(0.5, 1.05), dry=rng.uniform(0.2, 0.6),
                  taper=(0.02, rng.uniform(0.6, 0.95)), swell=rng.uniform(0.1, 0.6), maxseg=8)

    def tall_tree(x, base, w, ink, crown_lo, lean=0.0):
        """a trunk laid in one loaded side-brush stroke — its edges wander, it breaks into flying
        white where the brush skipped — then a few branches that each differ in kind"""
        top = -260
        mid = (base + top) / 2
        ctr = spline([(x, base), (x + lean * 0.4 + rng.normal(0, w * 0.3), mid + rng.normal(0, 60)), (x + lean, top)], 12)
        ctr[:, 0] += fbm1d(len(ctr), 8, 2, p.sd()) * w * 0.12
        pts = [S.pt(cx, cy) for cx, cy in ctr]
        side = rng.choice([-1, 1]) * rng.uniform(0.3, 0.8)
        # a near trunk is painted before the distance around it (the far trees are left out of it)
        tb = np.zeros_like(p.D) if w >= 30 else None
        broad_stroke(p, pts, S(w), min(0.95, ink * rng.uniform(0.72, 0.92)), dry=rng.uniform(0.3, 0.7),
                     taper=(0.02, 0.02), side=side * 0.7, pool=rng.uniform(0.1, 0.3), grow=(1.0, rng.uniform(0.6, 0.85)),
                     hair=rng.uniform(0.8, 1.2), maxseg=30, rough=0.9, pv=0.22, skip=1.3, buf=tb)
        if tb is not None:
            cov = np.clip(tb / max(0.3, float(tb.max())) * 1.6, 0, 1)
            np.multiply(p.D, 1 - 0.85 * cov, out=p.D)
            p.over(p.D, tb)
            del tb, cov

        def tx(yd):
            return float(np.interp(yd, ctr[::-1, 1], ctr[::-1, 0]))
        for k in range(int(rng.integers(0, 3))):                             # knots
            yy = rng.uniform(crown_lo, base - 30)
            p.wet_dot(*S.pt(tx(yy) + rng.uniform(-0.3, 0.3) * w, yy), S(rng.uniform(1.5, 3.5)) * (0.6 + w / 40),
                      ink * rng.uniform(0.7, 1.0), squash=rng.uniform(1.2, 2.2), irr=1.3)
        # where it meets the ground: a wet patch of shadow, a root or two, a tuft
        wet_patch(p, S.x(x + rng.normal(0, w * 0.3)), S.y(base + rng.uniform(0, 4)), S(w * rng.uniform(1.0, 2.0) + 10),
                  S(3 + w * rng.uniform(0.06, 0.12)), min(0.5, ink * rng.uniform(0.3, 0.5)), tilt=rng.normal(0, 0.05))
        for sd in ([-1, 1] if rng.random() < 0.5 else [rng.choice([-1, 1])]):
            if w < 14:
                break
            r0 = S.pt(tx(base - w * 0.6) + sd * w * 0.4, base - w * 0.6)
            r1 = S.pt(x + sd * w * rng.uniform(0.7, 1.2), base + rng.uniform(0, 4))
            brush(p, [r0, ((r0[0] + r1[0]) / 2, (r0[1] + r1[1]) / 2 + S(2)), r1], S(w * rng.uniform(0.15, 0.3)), ink * 0.8,
                  dry=0.5, taper=(0.05, 0.7), swell=0.3, maxseg=8)
        for j in range(int(rng.integers(0, 3))):
            tuft(S.x(x + rng.uniform(-1.4, 1.4) * (w + 14)), S.y(base + 3), S(rng.uniform(8, 22) * (0.6 + w / 40)), ink * 0.75)
        # branches: a few, at random heights (some close together, some far apart), each its own kind
        fol = ['pad', 'twig', 'pad', 'bare'][int(rng.integers(4))]
        nbr = int(rng.integers(1, 4 + int(w // 18)))
        ys = np.sort(rng.uniform(-40, crown_lo + 20, nbr))[::-1]
        bias = rng.choice([-1, 1])
        for y in ys:
            side_b = bias if rng.random() < 0.65 else -bias
            kind = ['bough', 'bough', 'stub', 'droop', 'zig'][int(rng.integers(5))]
            ln = rng.uniform(0.35, 1.1) * (30 + w * 2.0) * (0.6 + 0.4 * np.clip((y + 40) / max(1, crown_lo + 40), 0, 1))
            sx_ = tx(y) + side_b * w * 0.35
            bw = S(rng.uniform(1.6, 3.6)) * (0.8 + min(w, 40) / 60)
            ik = ink * rng.uniform(0.55, 0.95)
            if kind == 'stub':                       # a broken-off branch: one short pressed touch
                l2 = rng.uniform(6, 16) + w * 0.15
                a = rng.uniform(-0.6, 0.5)
                brush(p, [S.pt(sx_, y), S.pt(sx_ + side_b * l2 * np.cos(a), y + l2 * np.sin(a))], bw * rng.uniform(1.1, 1.8), ik,
                      dry=0.3, taper=(0.02, rng.uniform(0.2, 0.6)), swell=0.2, maxseg=4)
                continue
            if kind == 'zig':                        # a crooked branch that changes direction (蟹爪)
                a1 = rng.uniform(-0.6, 0.1); a2 = a1 + rng.choice([-1, 1]) * rng.uniform(0.5, 1.0)
                m1 = (sx_ + side_b * ln * 0.5 * np.cos(a1), y + ln * 0.5 * np.sin(a1))
                e = (m1[0] + side_b * ln * 0.5 * np.cos(a2), m1[1] + ln * 0.5 * np.sin(a2))
                brush(p, [S.pt(sx_, y), S.pt(*m1)], bw, ik, dry=0.4, taper=(0.02, 0.2), swell=0.2, maxseg=6)
                bpts = np.array([S.pt(*m1), S.pt(*e)], np.float32)
                brush(p, bpts, bw * 0.7, ik, dry=0.5, taper=(0.1, 0.85), swell=0.2, maxseg=6)
                bpts = np.linspace(bpts[0], bpts[1], 10)
            else:
                droop = rng.uniform(-0.45, 0.05) if kind == 'bough' else rng.uniform(0.25, 0.7)
                ex, ey = sx_ + side_b * ln * np.cos(droop), y + ln * np.sin(droop)
                bend = rng.normal(0, ln * 0.15) + (ln * 0.12 if kind == 'droop' else 0)
                bpts = curve(S.pt(sx_, y), S.pt(ex, ey), S(bend), 10)
                broad_stroke(p, bpts, bw, ik, dry=rng.uniform(0.3, 0.75), taper=(0.02, rng.uniform(0.6, 0.95)),
                             swell=rng.uniform(0.0, 0.4), pv=0.25, pool=0.2, maxseg=10)
            if fol == 'pad' or (fol == 'bare' and rng.random() < 0.3):
                for q in range(int(rng.integers(1, 4))):
                    bq = bpts[int(rng.uniform(0.35, 1.0) * 9)]
                    l2 = S(rng.uniform(8, 22)) * (0.7 + w / 70)
                    ang = rng.normal(0, 0.3)
                    broad_stroke(p, [(bq[0] - np.cos(ang) * l2, bq[1] + S(2) - np.sin(ang) * l2), (bq[0] + np.cos(ang) * l2, bq[1] + S(2) + np.sin(ang) * l2)],
                                 S(rng.uniform(5, 11)) * (0.7 + w / 70), ink * rng.uniform(0.18, 0.4), dry=rng.uniform(0.2, 0.6),
                                 taper=(0.3, 0.4), pool=rng.uniform(0.1, 0.4), side=rng.uniform(-0.6, 0.6), swell=0.5, maxseg=6)
            elif fol == 'twig':                       # the branch forks into a couple of thin twigs
                for q in range(int(rng.integers(1, 4))):
                    bq = bpts[int(rng.uniform(0.4, 1.0) * 9)]
                    a = (np.pi if side_b < 0 else 0) + side_b * rng.uniform(-0.9, 0.5)
                    l2 = S(rng.uniform(8, 26))
                    p.stroke(curve(tuple(bq), (bq[0] + np.cos(a) * l2, bq[1] + np.sin(a) * l2), S(rng.normal(0, 2)), 6),
                             S(rng.uniform(0.8, 1.5)), ink * rng.uniform(0.4, 0.8), dry=rng.uniform(0.3, 0.7), taper=(0.1, 0.8))

    # middle distance: more and closer together on the left (the dark side), sparse toward the light
    mids = [(300, 716, 24, 0.52, 260), (420, 694, 17, 0.44, 280), (505, 684, 11, 0.36, 300), (640, 672, 13, 0.38, 300),
            (742, 664, 8, 0.28, 340), (880, 656, 10, 0.3, 330), (985, 652, 6, 0.22, 360), (1080, 650, 7, 0.24, 360),
            (1300, 668, 12, 0.32, 320), (1440, 690, 18, 0.42, 300), (1890, 724, 26, 0.5, 260)]
    for i, (x, base, w, ink, lo) in enumerate(mids):
        tall_tree(x + rng.normal(0, 10), base, w * rng.uniform(0.75, 1.3), ink * rng.uniform(0.8, 1.15), lo, lean=rng.normal(0, 16))
        p.snap('tree')
    # undergrowth along both sides of the path: wet patches and tufts
    for k in range(44):
        side = rng.choice([-1, 1])
        y = VP[1] + 20 + (1090 - VP[1] - 20) * rng.random() ** 0.8
        c = float(np.interp(y, yk, ck)); w = float(np.interp(y, yk, wk))
        f = (y - VP[1]) / (1080 - VP[1])
        x = c + side * w * rng.uniform(1.05, 2.4)
        X, Y = S.x(x), S.y(y)
        if rng.random() < 0.55:
            wet_patch(p, X, Y, S(10 + 60 * f) * rng.uniform(0.5, 1.4), S(2 + 7 * f) * rng.uniform(0.6, 1.4),
                      (0.08 + 0.18 * f) * rng.uniform(0.6, 1.2), tilt=rng.normal(0, 0.06))
        if rng.random() < 0.75:
            tuft(X + S(rng.uniform(-14, 14) * (0.4 + f)), Y, S(10 + 34 * f) * rng.uniform(0.6, 1.3),
                 (0.22 + 0.45 * f) * rng.uniform(0.6, 1.0))
        if k % 15 == 14:
            p.snap('undergrowth')

    # ---------------------------------------------------------------- the deer, standing on the path, looking back
    def deer(dx, dy, k=1.0, ink=0.66):
        P = lambda x, y: S.pt(dx + x * k, dy + y * k)
        wet_patch(p, *P(0, 1), S(26 * k), S(3 * k), 0.16, pool=0.2)                       # ground shadow
        # barrel: one pressed stroke, heavier underneath; then the belly line
        brush(p, [P(-18, -39), P(-5, -44), P(9, -43), P(19, -38)], S(13 * k), ink, dry=0.15, taper=(0.3, 0.35),
              swell=0.5, side=0.3, pool=0.05, skip=0.3)
        brush(p, [P(-13, -34), P(1, -32.5), P(14, -35)], S(5.5 * k), ink * 0.85, dry=0.3, taper=(0.3, 0.4), swell=0.5)
        # neck rising from the shoulder, thinning to the head; the head turned back, muzzle tapered
        brush(p, [P(-13, -42), P(-16, -51), P(-18.5, -60)], S(7 * k), ink, dry=0.2, taper=(0.05, 0.4), grow=(1.0, 0.6), swell=0.2)
        brush(p, [P(-17, -62), P(-22, -61.5), P(-28, -58)], S(5.4 * k), ink, dry=0.15, taper=(0.05, 0.8), swell=0.5)
        brush(p, [P(-16, -63), P(-11.5, -65.5)], S(1.9 * k), ink * 0.9, dry=0.1, taper=(0.05, 0.85), swell=0.3, maxseg=4)
        brush(p, [P(-20.5, -63.5), P(-25.5, -65)], S(1.7 * k), ink * 0.85, dry=0.1, taper=(0.05, 0.85), swell=0.3, maxseg=4)
        for sgn, reach, tines in ((1, 1.0, (0.35, 0.7)), (-1, 0.85, (0.5,))):            # antlers: not a mirror pair
            base = P(-18.5 + 1.5 * sgn, -65)
            beam = spline([base, P(-18 + 5 * sgn * reach, -75 * reach - 2), P(-16 + 10 * sgn * reach, -88 * reach + 1)], 6)
            p.stroke(beam, S(1.5 * k), ink, dry=0.15, taper=(0.05, 0.7))
            for t_ in tines:
                q = beam[int(t_ * (len(beam) - 1))]
                p.stroke([tuple(q), (q[0] - S(rng.uniform(3, 5) * k) * sgn * 0.5, q[1] - S(rng.uniform(5, 8) * k))], S(1.2 * k), ink,
                         dry=0.15, taper=(0.05, 0.8))
        # legs: each pressed at the hip and drawn out to a fine point at the hoof; a foreleg lifted
        for (x0, xk, yk_, x1, y1_) in ((-14, -15.5, -19, -14.5, 0), (-9, -6, -21, -9.5, -6), (11, 13.5, -18, 12, 0), (15.5, 18.5, -19, 17.5, 0.5)):
            brush(p, [P(x0, -38), P(xk, yk_), P(x1, y1_)], S(6.5 * k), ink, dry=0.1, taper=(0.0, 0.6), grow=(1.0, 0.5),
                  swell=0.1, pool=0.05, skip=0.2, maxseg=8)
        brush(p, [P(18, -43), P(21, -40), P(22, -36)], S(2.6 * k), ink * 0.8, dry=0.2, taper=(0.1, 0.8), swell=0.4, maxseg=4)

    deer(VP[0] - 10, 668, 1.2, 0.62)
    p.snap('deer')

    # ---------------------------------------------------------------- near trunks framing the view (not a mirror pair)
    for (x, base, w, ink, lo, lean) in [(150, 1190, 112, 0.88, 150, -18), (1630, 1100, 52, 0.74, 200, 10),
                                        (1748, 1170, 36, 0.66, 240, 24), (560, 1010, 32, 0.6, 250, -6)]:
        tall_tree(x, base, w * rng.uniform(0.9, 1.1), ink, lo, lean + rng.normal(0, 10))
        p.snap('near trunk')
    # foreground: orchid-leaf grass, a big clump in the lower left and a small one at the right
    for k in range(26):
        left = k < 19
        X0 = S.x(rng.uniform(-80, 420) if left else rng.uniform(1640, 1960))
        Y0 = S.y(max(1060, S.Y1 - 20) + rng.uniform(0, 50))
        ln = S(rng.uniform(60, 300) if left else rng.uniform(50, 170)) + (Y0 - S.y(1080))
        a = rng.uniform(-0.2, 0.9) if left else rng.uniform(-0.6, 0.3)
        bend = rng.uniform(0.1, 0.55) * (1 if a > 0.2 else -1)
        tip = (X0 + ln * np.sin(a), Y0 - ln * np.cos(a))
        mid = (X0 + ln * np.sin(a) * 0.45 + ln * bend * 0.3, Y0 - ln * np.cos(a) * 0.6)
        brush(p, [(X0, Y0), mid, (tip[0] + ln * bend * 0.4, tip[1] + ln * 0.15)], S(rng.uniform(2.5, 7.5)),
              rng.uniform(0.35, 0.9), dry=rng.uniform(0.25, 0.65), taper=(0.05, 0.9), swell=rng.uniform(0.3, 0.8), n=10)
    p.snap('ferns')

    p.end()
    return p.finish()


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else 'inkwash_forest.png'
    W = int(sys.argv[2]) if len(sys.argv) > 2 else 1920
    H = int(sys.argv[3]) if len(sys.argv) > 3 else 1080
    cw = sys.argv[4] if len(sys.argv) > 4 else "BlackInk"
    bl = float(sys.argv[5]) if len(sys.argv) > 5 else 0.0
    save_png(paint(W, H, colourway=cw, bleed=bl), out)
    print('saved', out)
