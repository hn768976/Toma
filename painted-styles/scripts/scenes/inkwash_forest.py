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
from inkwash_kit import (Ink, conifer, wet_tree, fill_poly, broad_stroke, wash_field, vnz, sstep, STYLE,
                         COLOURWAYS)

LIB = "inkpaint"
GROUPS = ("all",)
VP = (1010, 610)          # where the path vanishes into the mist


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
        x += rng.choice([rng.uniform(14, 40), rng.uniform(50, 150)])
    for i, x in enumerate(far):
        base = 640 + rng.uniform(-14, 10)
        top = rng.uniform(150, 470)
        ink = rng.uniform(0.07, 0.24) * (0.6 if 1250 < x < 1750 else 1.0)
        r = rng.random()
        if r < 0.5:
            conifer(p, S.x(x), S.y(top), S.y(base), ink, wind=rng.normal(0, 0.2), halo=rng.uniform(0.6, 1.8),
                    spread=rng.uniform(0.4, 0.75), bare=rng.uniform(0.08, 0.3), style=('wet', 'mixed', 'brush')[int(rng.integers(3))])
        elif r < 0.8:
            wet_tree(p, S.x(x), S.y(base - min(140, (base - top) * rng.uniform(0.25, 0.5))), S.y(base), ink * 1.2, lean=rng.normal(0, 0.05))
        else:                                           # just a pale upright stroke: a trunk lost in the mist
            broad_stroke(p, [S.pt(x, base), S.pt(x + rng.normal(0, 6), top)], S(rng.uniform(4, 12)), ink * 0.9,
                         dry=rng.uniform(0.3, 0.8), taper=(0.1, 0.6), pool=0.3, maxseg=12)
        if i % 12 == 11:
            p.snap('far trees')
    # mist swallowing their feet: bare paper reserved with ragged edges
    y0, y1 = int(max(0, S.y(470))), int(min(CH, S.y(720)))
    Ym, Xm = YY[y0:y1], XX[y0:y1]
    wob = fbm1d(CW, S(380), 3, p.sd())[None, :] * S(40)
    half = (S(35) + S(55) * np.clip(0.5 + fbm1d(CW, S(260), 3, p.sd()), 0, 1))[None, :]
    mz = vnz(rng, Ym, Xm, S(16), S(90), 3)
    m = np.clip((half - np.abs(Ym - S.y(600) - wob) + mz * S(16)) / S(30), 0, 1)
    np.multiply(p.D[y0:y1], 1 - 0.9 * m, out=p.D[y0:y1])
    p.snap('far mist')

    # ---------------------------------------------------------------- the path and the forest floor
    # path centre line and half-width (design px) as functions of y, from the bottom up to the vanishing point
    yk = np.array([VP[1], 660, 760, 900, 1080, 1400], np.float32)
    ck = np.array([VP[0], 1000, 1050, 960, 1030, 1080], np.float32)
    wk = np.array([10, 28, 70, 150, 260, 420], np.float32)
    sp = spline(np.stack([ck, yk], 1), 24)                 # smooth S-curve, monotone in y
    ws = spline(np.stack([wk, yk], 1), 24)
    yk, ck = sp[:, 1].copy(), sp[:, 0].copy()
    wk = np.interp(yk, ws[:, 1], ws[:, 0])
    y0 = int(max(0, S.y(VP[1] - 30)))
    YDf, XDf = YD[y0:CH], XD[y0:CH]
    pc = np.interp(YDf, yk, ck)
    pw = np.interp(YDf, yk, wk) * (1 + 0.12 * vnz(rng, YY[y0:CH], XX[y0:CH], S(60), S(90), 2) * 0.5)
    outside = (np.abs(XDf - pc) - pw) * s                    # px outside the path edge (path = reserved paper)
    # the floor: two pale washes laid either side of the path, the nearer one deeper, edges left ragged
    g1 = S.y(VP[1] + 6) + fbm1d(CW, S(200), 3, p.sd())[None, :] * S(10)
    wash_field(p, y0, CH, 0, CW, np.minimum(YY[y0:CH] - g1, outside + S(4)), 0.13, S(30), pool=0.4)
    g2 = S.y(800) + fbm1d(CW, S(260), 4, p.sd())[None, :] * S(60)
    wash_field(p, y0, CH, 0, CW, np.minimum(YY[y0:CH] - g2, outside - S(10)), 0.16, S(70), pool=0.35)
    g3 = S.y(960) + fbm1d(CW, S(220), 4, p.sd())[None, :] * S(50)
    wash_field(p, y0, CH, 0, CW, np.minimum(YY[y0:CH] - g3, outside - S(30)), 0.14, S(60), pool=0.3)
    p.snap('path')
    # dry ruts and leaf strokes on the path, converging to the vanishing point
    for k in range(34):
        y = rng.uniform(VP[1] + 30, 1075)
        c = float(np.interp(y, yk, ck)); w = float(np.interp(y, yk, wk))
        x = c + rng.uniform(-0.7, 0.7) * w
        f = (y - VP[1]) / (1080 - VP[1])
        ln = rng.uniform(8, 60) * (0.3 + f)
        X, Y = S.x(x), S.y(y)
        p.stroke([(X, Y), (X + S(ln), Y + S(rng.normal(0, 1.5)))], S((0.6 + 2.0 * f) * rng.uniform(0.6, 1.4)),
                 (0.08 + 0.16 * f) * rng.uniform(0.6, 1.3), dry=rng.uniform(0.5, 0.85), taper=(rng.uniform(0.1, 0.4), 0.4))
    for k in range(40):      # faint dry strokes across the forest floor, flattening with distance
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
        """a grass tuft: a varying number of blades, lengths, curls and weights"""
        nb = int(rng.integers(1, 8))
        fan = rng.uniform(0.4, 1.3)
        for j in range(nb):
            a = rng.uniform(-fan, fan) + rng.normal(0, 0.1)
            ln = size * rng.uniform(0.35, 1.2) * (1.6 if rng.random() < 0.15 else 1.0)
            curl = rng.uniform(-0.5, 0.5)
            X, Y = gx + rng.uniform(-0.3, 0.3) * size, gy
            p.stroke(spline([(X, Y), (X + ln * np.sin(a) * 0.45, Y - ln * 0.55),
                             (X + ln * (np.sin(a) + curl * 0.6), Y - ln * (0.92 - abs(curl) * 0.3))], 6),
                     S(rng.uniform(0.8, 2.4)) * (0.6 + size / S(40)), ink * rng.uniform(0.5, 1.05), dry=rng.uniform(0.25, 0.65),
                     taper=(0.02, rng.uniform(0.6, 0.95)))

    def tall_tree(x, base, w, ink, crown_lo, lean=0.0):
        """a trunk brushed in one or two loaded side-brush strokes, with dry-brush breaks, a few bark
        touches, and branches that differ in height, reach, droop and foliage"""
        top = -260
        mid = (base + top) / 2
        ctr = spline([(x, base), (x + lean * 0.4 + rng.normal(0, w * 0.3), mid + rng.normal(0, 60)), (x + lean, top)], 12)
        ctr[:, 0] += fbm1d(len(ctr), 8, 2, p.sd()) * w * 0.12
        pts = [S.pt(cx, cy) for cx, cy in ctr]
        side = rng.choice([-1, 1]) * rng.uniform(0.3, 0.9)
        broad_stroke(p, pts, S(w), min(0.95, ink * rng.uniform(0.65, 0.9)), dry=rng.uniform(0.25, 0.7),
                     taper=(0.02, 0.02), side=side * 1.3, pool=rng.uniform(0.1, 0.35), grow=(1.0, rng.uniform(0.6, 0.85)),
                     hair=rng.uniform(0.7, 1.2), maxseg=30, rough=0.6)
        if rng.random() < 0.65:                   # a second, drier pull along the shadow edge, broken
            t0 = rng.uniform(0.0, 0.3); t1 = rng.uniform(0.55, 1.0)
            seg = ctr[int(t0 * (len(ctr) - 1)):int(t1 * (len(ctr) - 1)) + 1].copy()
            seg[:, 0] += np.sign(side) * w * rng.uniform(0.25, 0.38)
            broad_stroke(p, [S.pt(a, b) for a, b in seg], S(w * rng.uniform(0.18, 0.35)), min(0.95, ink * rng.uniform(0.7, 1.0)),
                         dry=rng.uniform(0.5, 0.85), taper=(0.05, 0.3), pool=0.4, maxseg=20)

        def tx(yd):
            return float(np.interp(yd, ctr[::-1, 1], ctr[::-1, 0]))
        for k in range(int(rng.integers(2, 6 + w // 8))):                  # bark: short broken touches
            yy = rng.uniform(top + 80, base - 10)
            cx = tx(yy) + rng.uniform(-0.35, 0.35) * w
            ln = w * rng.uniform(0.15, 0.55)
            p.stroke([S.pt(cx - ln / 2, yy + rng.normal(0, 1)), S.pt(cx + ln / 2, yy + rng.normal(0, 3))],
                     S(rng.uniform(1.0, 2.6)) * (0.6 + w / 50), ink * rng.uniform(0.4, 0.95), dry=rng.uniform(0.4, 0.85),
                     taper=(0.2, 0.4))
        for k in range(int(rng.integers(0, 3))):                             # knots
            yy = rng.uniform(crown_lo, base - 30)
            p.wet_dot(*S.pt(tx(yy) + rng.uniform(-0.3, 0.3) * w, yy), S(rng.uniform(1.5, 3.5)) * (0.6 + w / 40),
                      ink * rng.uniform(0.7, 1.0), squash=rng.uniform(1.2, 2.2))
        # where it meets the ground: a short loaded pull and a tuft or two
        broad_stroke(p, [S.pt(x - w * rng.uniform(0.8, 1.6), base + rng.uniform(-1, 3)), S.pt(x + w * rng.uniform(0.8, 1.6), base + rng.uniform(-1, 3))],
                     S(3 + w * 0.12) * rng.uniform(0.7, 1.3), min(0.6, ink * 0.6), dry=rng.uniform(0.3, 0.7), taper=(0.2, 0.4), pool=0.3)
        for j in range(int(rng.integers(0, 3))):
            tuft(S.x(x + rng.uniform(-1.4, 1.4) * (w + 14)), S.y(base + 3), S(rng.uniform(8, 22) * (0.6 + w / 40)), ink * 0.75)
        # branches, each its own
        fol = ['pad', 'needle', 'pad', 'bare'][int(rng.integers(4))]
        y = crown_lo + rng.uniform(-30, 30)
        while y > -40:
            for side_b in ([rng.choice([-1, 1])] if rng.random() < 0.7 else [-1, 1]):
                ln = rng.uniform(0.35, 1.0) * (30 + w * 2.0) * (0.6 + 0.4 * np.clip((y + 40) / max(1, crown_lo + 40), 0, 1))
                droop = rng.uniform(-0.35, 0.45)
                sx_ = tx(y) + side_b * w * 0.35
                ex, ey = sx_ + side_b * ln * np.cos(droop), y + ln * np.sin(droop)
                bpts = curve(S.pt(sx_, y), S.pt(ex, ey), S(rng.normal(0, ln * 0.12)), 10)
                p.stroke(bpts, S(rng.uniform(1.4, 3.6)) * (0.7 + w / 60), ink * rng.uniform(0.55, 0.95),
                         dry=rng.uniform(0.35, 0.8), taper=(0.05, rng.uniform(0.6, 0.95)), jitter=rng.uniform(0.5, 1.2))
                if fol == 'pad' or (fol == 'bare' and rng.random() < 0.3):
                    for q in range(int(rng.integers(1, 4))):
                        bq = bpts[int(rng.uniform(0.35, 1.0) * 9)]
                        l2 = S(rng.uniform(8, 22)) * (0.7 + w / 70)
                        ang = rng.normal(0, 0.25)
                        broad_stroke(p, [(bq[0] - np.cos(ang) * l2, bq[1] + S(2) - np.sin(ang) * l2), (bq[0] + np.cos(ang) * l2, bq[1] + S(2) + np.sin(ang) * l2)],
                                     S(rng.uniform(5, 11)) * (0.7 + w / 70), ink * rng.uniform(0.18, 0.4), dry=rng.uniform(0.2, 0.6),
                                     taper=(0.3, 0.4), pool=rng.uniform(0.1, 0.4), side=rng.uniform(-0.6, 0.6), maxseg=6)
                elif fol == 'needle':                     # a fan of needles at the tip, sometimes one midway
                    for tq in ([1.0] if rng.random() < 0.6 else [1.0, rng.uniform(0.45, 0.75)]):
                        bq = bpts[int(tq * 9)]
                        nf = int(rng.integers(4, 12))
                        a0 = (np.pi if side_b < 0 else 0) + side_b * rng.uniform(0.1, 0.6)
                        span = rng.uniform(1.4, 2.6)
                        l0 = S(rng.uniform(6, 15)) * (0.7 + w / 70)
                        for a in a0 + span * (np.sort(rng.random(nf)) - 0.5):
                            l2 = l0 * rng.uniform(0.6, 1.25)
                            p.stroke([tuple(bq), (bq[0] + np.cos(a) * l2, bq[1] + np.sin(a) * l2 * 0.7 + l2 * 0.25)],
                                     S(rng.uniform(0.8, 1.6)), ink * rng.uniform(0.4, 0.85), dry=rng.uniform(0.25, 0.6),
                                     taper=(0.1, 0.7))
            y -= rng.choice([rng.uniform(18, 40), rng.uniform(50, 110)])

    mids = [(560, 672, 13, 0.36, 300), (700, 662, 10, 0.30, 330), (1250, 664, 11, 0.32, 320), (1390, 676, 15, 0.38, 290),
            (430, 690, 18, 0.44, 280), (1560, 700, 20, 0.42, 300), (820, 650, 7, 0.22, 360), (1180, 652, 8, 0.25, 360),
            (300, 720, 24, 0.52, 260), (1720, 730, 26, 0.5, 260)]
    for i, (x, base, w, ink, lo) in enumerate(mids):
        tall_tree(x + rng.normal(0, 10), base, w * rng.uniform(0.75, 1.3), ink * rng.uniform(0.8, 1.15), lo, lean=rng.normal(0, 14))
        p.snap('tree')
    # undergrowth along both sides of the path: broken pale wet pulls and tufts
    for k in range(46):
        side = rng.choice([-1, 1])
        y = VP[1] + 20 + (1090 - VP[1] - 20) * rng.random() ** 0.8
        c = float(np.interp(y, yk, ck)); w = float(np.interp(y, yk, wk))
        f = (y - VP[1]) / (1080 - VP[1])
        x = c + side * w * rng.uniform(1.05, 2.4)
        X, Y = S.x(x), S.y(y)
        if rng.random() < 0.6:
            ln = S(20 + 110 * f) * rng.uniform(0.5, 1.4)
            broad_stroke(p, [(X - ln / 2, Y + rng.normal(0, S(1))), (X, Y - S(rng.uniform(0, 3))), (X + ln / 2, Y + rng.normal(0, S(1)))],
                         S(3 + 12 * f) * rng.uniform(0.6, 1.3), (0.08 + 0.2 * f) * rng.uniform(0.6, 1.2), dry=rng.uniform(0.3, 0.8),
                         taper=(rng.uniform(0.2, 0.5), rng.uniform(0.2, 0.5)), pool=rng.uniform(0.1, 0.5), maxseg=10)
        if rng.random() < 0.75:
            tuft(X + S(rng.uniform(-14, 14) * (0.4 + f)), Y, S(10 + 34 * f) * rng.uniform(0.6, 1.3),
                 (0.22 + 0.45 * f) * rng.uniform(0.6, 1.0))
        if k % 15 == 14:
            p.snap('undergrowth')

    # ---------------------------------------------------------------- the deer, standing on the path, looking back
    def deer(dx, dy, k=1.0, ink=0.66):
        P = lambda x, y: S.pt(dx + x * k, dy + y * k)
        p.blob(*P(0, 1), S(30 * k), S(3 * k), 0.18, rough=0.3)                         # ground shadow
        p.stroke(spline([P(-17, -40), P(-4, -43), P(10, -42), P(18, -40)], 8), S(11 * k), ink, dry=0.15,
                 taper=(0.45, 0.4), jitter=0.3)                                                      # back and barrel
        p.stroke(spline([P(-13, -36), P(0, -35), P(13, -37)], 8), S(6 * k), ink * 0.85, dry=0.2, taper=(0.35, 0.35), jitter=0.3)
        p.stroke(spline([P(-13, -44), P(-16, -52), P(-18, -61)], 6), S(5.5 * k), ink, dry=0.15, taper=(0.05, 0.35), jitter=0.3)
        p.stroke(spline([P(-18, -63), P(-23, -61), P(-27, -58)], 6), S(4.4 * k), ink, dry=0.1, taper=(0.1, 0.6), jitter=0.2)
        p.stroke([P(-17, -64), P(-11, -67)], S(2.2 * k), ink * 0.9, dry=0.1, taper=(0.1, 0.7))         # ears
        p.stroke([P(-20, -64), P(-26, -67)], S(2.2 * k), ink * 0.9, dry=0.1, taper=(0.1, 0.7))
        for sgn in (1, -1):                                                                              # antlers
            base = P(-18.5 + 1.5 * sgn, -65)
            beam = spline([base, P(-18 + 6 * sgn, -76), P(-16 + 11 * sgn, -89)], 6)
            p.stroke(beam, S(1.4 * k), ink, dry=0.15, taper=(0.1, 0.6))
            for t in (0.4, 0.75):
                q = beam[int(t * (len(beam) - 1))]
                p.stroke([tuple(q), (q[0] - S(4 * k) * sgn * 0.4, q[1] - S(7 * k))], S(1.1 * k), ink, dry=0.15, taper=(0.1, 0.7))
        for (x0, xk, x1) in ((-13, -14, -14), (-9, -8, -7), (11, 14, 12), (15, 18, 17)):                # legs with a knee
            p.stroke(spline([P(x0, -37), P(xk, -18), P(x1, 0)], 6), S(1.6 * k), ink, dry=0.1, taper=(0.05, 0.3))
        p.stroke([P(18, -44), P(21, -38)], S(2.2 * k), ink * 0.8, dry=0.2, taper=(0.1, 0.6))           # tail

    deer(1020, 668, 1.2, 0.62)
    p.snap('deer')

    # ---------------------------------------------------------------- near trunks framing the view
    for (x, base, w, ink, lo, lean) in [(120, 1180, 92, 0.86, 160, -20), (1820, 1200, 104, 0.88, 140, 18),
                                        (1500, 1060, 46, 0.72, 220, 8), (470, 1010, 40, 0.68, 240, -6)]:
        tall_tree(x, base, w * rng.uniform(0.85, 1.15), ink, lo, lean + rng.normal(0, 10))
        p.snap('near trunk')
    # foreground: long orchid-leaf grass blades sweeping out of the corners, in uneven clumps
    for k in range(30):
        left = k % 2 == 0
        X0 = S.x(rng.uniform(-80, 380) if left else rng.uniform(1560, 2000))
        Y0 = S.y(max(1060, S.Y1 - 20) + rng.uniform(0, 50))
        ln = S(rng.uniform(60, 280)) + (Y0 - S.y(1080))
        a = rng.uniform(-0.75, 0.45) if left else rng.uniform(-0.45, 0.75)
        bend = rng.uniform(0.1, 0.5) * (1 if a > 0 else -1)
        tip = (X0 + ln * np.sin(a), Y0 - ln * np.cos(a))
        mid = (X0 + ln * np.sin(a) * 0.45 + ln * bend * 0.3, Y0 - ln * np.cos(a) * 0.6)
        p.stroke(spline([(X0, Y0), mid, (tip[0] + ln * bend * 0.4, tip[1] + ln * 0.15)], 10),
                 S(rng.uniform(2.0, 6.0)), rng.uniform(0.35, 0.9), dry=rng.uniform(0.3, 0.7), taper=(0.05, 0.9), jitter=0.7)
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
