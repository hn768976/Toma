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
from inkwash_kit import Ink, conifer, fill_poly, STYLE, COLOURWAYS

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

    # ---------------------------------------------------------------- airy background tone
    bg = 0.10 + 0.10 * np.clip(1 - YD / 600, 0, 1.2) * (0.6 + 0.4 * p.noise2d(S(300), 4, seed + 3))
    p.over(p.D, bg)
    # the canopy: a dark, broken foliage wash hanging from the top edge
    cano = np.clip(1 - YD / 330, 0, 1.3) ** 1.4 * (0.45 + 0.55 * p.noise2d(S(110), 4, seed + 7))
    p.over(p.D, 0.55 * np.clip(cano, 0, 1))
    p.snap('air')

    # ---------------------------------------------------------------- far forest: pale conifers dissolving in mist
    far = []
    x = S.X0 - 40
    while x < S.X1 + 40:
        far.append(x)
        x += rng.uniform(40, 120)
    for i, x in enumerate(far):
        base = 640 + rng.uniform(-10, 10)
        top = rng.uniform(120, 420)
        ink = rng.uniform(0.12, 0.24)
        conifer(p, S.x(x), S.y(top), S.y(base), ink, wind=rng.normal(0, 0.2), halo=1.6, spread=0.62, bare=0.15)
        if i % 12 == 11:
            p.snap('far trees')
    # mist swallowing their feet
    m = np.exp(-((YD - 600 - 60 * (p.noise2d(S(380), 3, seed + 41) - 0.5)) / 95) ** 2)
    np.multiply(p.D, 1 - 0.8 * m * (0.7 + 0.3 * p.noise2d(S(160), 3, seed + 42)), out=p.D)
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
    pc = np.interp(YD, yk, ck)
    pw = np.interp(YD, yk, wk) * (1 + 0.12 * (p.noise2d(S(90), 3, seed + 51) - 0.5))
    ground = np.clip((YD - VP[1] + 20) / 60, 0, 1)
    depth = np.clip((YD - VP[1]) / (1080 - VP[1]), 0, 1.3)
    floor = ground * (0.10 + 0.42 * depth ** 1.2) * (0.6 + 0.4 * p.noise2d(S(70), 4, seed + 52))
    p.over(p.D, floor)
    edge = np.abs(XD - pc) / np.maximum(pw, 1)
    path = np.clip((1.0 - edge) / 0.18, 0, 1) * ground
    np.multiply(p.D, 1 - 0.85 * path * (0.8 + 0.2 * p.noise2d(S(30), 3, seed + 53)), out=p.D)
    # a soft darker margin where the floor meets the path
    margin = np.exp(-((edge - 1.05) / 0.12) ** 2) * ground * (YD > VP[1] + 15)
    p.over(p.D, 0.16 * margin * depth * (0.5 + 0.5 * p.noise2d(S(40), 3, seed + 54)))
    p.snap('path')
    # dry ruts and leaf strokes on the path, converging to the vanishing point
    for k in range(40):
        y = rng.uniform(VP[1] + 30, 1075)
        c = float(np.interp(y, yk, ck)); w = float(np.interp(y, yk, wk))
        x = c + rng.uniform(-0.7, 0.7) * w
        f = (y - VP[1]) / (1080 - VP[1])
        ln = rng.uniform(14, 50) * (0.3 + f)
        X, Y = S.x(x), S.y(y)
        p.stroke([(X, Y), (X + S(ln), Y + S(rng.normal(0, 1.5)))], S(1.0 + 1.5 * f), 0.10 + 0.14 * f, dry=0.7, taper=(0.3, 0.4))
    for k in range(46):      # faint dry strokes across the forest floor, flattening with distance
        y = rng.uniform(VP[1] + 15, 1070)
        c = float(np.interp(y, yk, ck)); w = float(np.interp(y, yk, wk))
        side = rng.choice([-1, 1])
        x = c + side * (w * 1.1 + rng.uniform(0, 900))
        f = (y - VP[1]) / (1080 - VP[1])
        ln = rng.uniform(40, 140) * (0.3 + f)
        X, Y = S.x(x), S.y(y)
        p.stroke(spline([(X, Y), (X + S(ln) / 2, Y - S(1 + 2 * f)), (X + S(ln), Y)], 6), S(1.2 + 2 * f), 0.08 + 0.14 * f,
                 dry=0.7, taper=(0.3, 0.4))
    p.snap('path marks')

    # ---------------------------------------------------------------- mid-distance tall trees (trunks run out of frame)
    def tall_tree(x, base, w, ink, crown_lo, lean=0.0):
        """a tall trunk (design x, base y, width w) with bark marks and boughs from crown_lo upward"""
        top = -260
        ctr = spline([(x, base), (x + lean * 0.4 + rng.normal(0, w * 0.15), (base + top) / 2), (x + lean, top)], 20)
        hw = np.interp(ctr[:, 1], [top, base], [w * 0.38, w * 0.55])
        L = [(S.x(cx - hwi), S.y(cy)) for (cx, cy), hwi in zip(ctr, hw)]
        R = [(S.x(cx + hwi), S.y(cy)) for (cx, cy), hwi in zip(ctr, hw)]
        poly = L + R[::-1]
        fill_poly(p, poly, -0.9, rough=0.0, soft=S(0.8))         # trunks stand in front of what's behind
        fill_poly(p, poly, min(0.95, ink * 1.05), rough=0.3, soft=S(1.0))
        # shaded left side (light comes from the upper right) and dry bark edges
        shade = [(S.x(cx - hwi), S.y(cy)) for (cx, cy), hwi in zip(ctr, hw)] + \
                [(S.x(cx - hwi * 0.1), S.y(cy)) for (cx, cy), hwi in zip(ctr, hw)][::-1]
        fill_poly(p, shade, ink * 0.5, rough=0.5, soft=S(1.5))
        lit = [(S.x(cx + hwi * 0.35), S.y(cy)) for (cx, cy), hwi in zip(ctr, hw)] + \
              [(S.x(cx + hwi * 0.8), S.y(cy)) for (cx, cy), hwi in zip(ctr, hw)][::-1]
        fill_poly(p, lit, -0.28, rough=0.6, soft=S(2.0))                # a lit streak on the sun side
        p.stroke(np.array(L), S(max(1.6, w * 0.10)), ink * 0.9, dry=0.6, taper=(0.02, 0.02), jitter=0.8)
        p.stroke(np.array(R), S(max(1.2, w * 0.06)), ink * 0.6, dry=0.75, taper=(0.02, 0.02), jitter=0.8)
        for k in range(int(4 + (base - top) * w / 2500)):           # bark: long broken dry streaks along the grain
            t0 = rng.uniform(0.0, 0.9); t1 = min(1.0, t0 + rng.uniform(0.05, 0.2))
            off = rng.uniform(-0.8, 0.5)
            seg = ctr[int(t0 * (len(ctr) - 1)):int(t1 * (len(ctr) - 1)) + 2]
            if len(seg) < 2:
                continue
            hwv = np.interp(seg[:, 1], [top, base], [w * 0.38, w * 0.55])
            pts = [S.pt(cx + off * hwi + rng.normal(0, 0.5), cy) for (cx, cy), hwi in zip(seg, hwv)]
            p.stroke(pts, S(max(1.4, w * rng.uniform(0.06, 0.14))), ink * rng.uniform(0.5, 0.9), dry=0.75,
                     taper=(0.2, 0.3), jitter=0.6)
        # where it meets the ground: a wet shadow and a few root/grass flicks
        p.blob(S.x(x), S.y(base - 2), S(w * 1.6 + 26), S(4 + w * 0.14), min(0.7, 0.45 * ink + 0.1), rough=0.6)
        for j in range(int(rng.integers(3, 7))):
            gx = x + rng.uniform(-1.2, 1.2) * (w + 12)
            ln = rng.uniform(8, 22) * (0.6 + w / 40)
            a = rng.uniform(-0.8, 0.8)
            p.stroke(spline([S.pt(gx, base + 2), S.pt(gx + ln * np.sin(a) * 0.4, base + 2 - ln * 0.5),
                             S.pt(gx + ln * np.sin(a), base + 2 - ln * 0.9)], 6),
                     S(1.2 + w * 0.03), ink * 0.7, dry=0.5, taper=(0.02, 0.85))
        # crown: brushy conifer tiers on the upper trunk (the top runs out of frame)
        conifer(p, S.x(x + lean), S.y(top), S.y(crown_lo + 60), ink * 0.95, wind=rng.normal(0, 0.3), halo=1.8,
                spread=0.32 + w / 400, bare=0.0, trunk_w=0)

    mids = [(560, 672, 13, 0.36, 300), (700, 662, 10, 0.32, 330), (1250, 664, 11, 0.34, 320), (1390, 676, 15, 0.38, 290),
            (430, 690, 18, 0.42, 280), (1560, 700, 20, 0.44, 300), (820, 650, 7, 0.26, 360), (1180, 652, 8, 0.28, 360),
            (300, 720, 24, 0.5, 260), (1720, 730, 26, 0.5, 260)]
    for i, (x, base, w, ink, lo) in enumerate(mids):
        tall_tree(x, base, w, ink, lo, lean=rng.normal(0, 12))
        p.snap('tree')
    # undergrowth along both sides of the path: low wet bush washes with a few loose grass blades
    for k in range(60):
        side = rng.choice([-1, 1])
        y = rng.uniform(VP[1] + 20, 1090)
        c = float(np.interp(y, yk, ck)); w = float(np.interp(y, yk, wk))
        f = (y - VP[1]) / (1080 - VP[1])
        x = c + side * w * rng.uniform(1.02, 2.2)
        X, Y = S.x(x), S.y(y)
        p.blob(X, Y - S(4 + 10 * f), S(14 + 70 * f) * rng.uniform(0.6, 1.3), S(4 + 16 * f), (0.10 + 0.25 * f) * rng.uniform(0.6, 1.1),
               rough=0.7)
        for j in range(int(rng.integers(1, 4))):
            ln = rng.uniform(10, 36) * (0.4 + 1.6 * f)
            a = rng.uniform(-0.9, 0.9) + side * 0.25
            bx = X + S(rng.uniform(-12, 12) * (0.4 + f))
            p.stroke(spline([(bx, Y), (bx + S(ln) * np.sin(a) * 0.4, Y - S(ln) * 0.55), (bx + S(ln) * np.sin(a) * 1.1, Y - S(ln) * 0.9)], 6),
                     S(1.0 + 1.6 * f), (0.2 + 0.45 * f) * rng.uniform(0.6, 1.0), dry=0.5, taper=(0.02, 0.85))
        if k % 20 == 19:
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
        tall_tree(x, base, w, ink, lo, lean)
        p.snap('near trunk')
    # foreground: long orchid-leaf grass blades sweeping out of the corners
    for k in range(34):
        left = k % 2 == 0
        X0 = S.x(rng.uniform(-80, 380) if left else rng.uniform(1560, 2000))
        Y0 = S.y(rng.uniform(1060, 1110))
        ln = S(rng.uniform(90, 260))
        a = rng.uniform(-0.75, 0.45) if left else rng.uniform(-0.45, 0.75)
        bend = rng.uniform(0.15, 0.45) * (1 if a > 0 else -1)
        tip = (X0 + ln * np.sin(a), Y0 - ln * np.cos(a))
        mid = (X0 + ln * np.sin(a) * 0.45 + ln * bend * 0.3, Y0 - ln * np.cos(a) * 0.6)
        p.stroke(spline([(X0, Y0), mid, (tip[0] + ln * bend * 0.4, tip[1] + ln * 0.15)], 10),
                 S(rng.uniform(3.0, 5.5)), rng.uniform(0.45, 0.9), dry=rng.uniform(0.35, 0.6), taper=(0.05, 0.9), jitter=0.7)
    p.snap('ferns')

    # ---------------------------------------------------------------- sun rays: shafts of lifted ink from the upper right
    sx, sy = S.x(1560), S.y(-260)
    ang = np.arctan2(YY - sy, XX - sx)
    dist = np.hypot(XX - sx, YY - sy)
    rays = np.zeros_like(p.D)
    for a0, wdt, st in [(1.98, 0.022, 0.55), (2.08, 0.012, 0.45), (2.20, 0.03, 0.6), (2.33, 0.016, 0.5),
                        (2.45, 0.026, 0.5), (2.58, 0.013, 0.4), (1.86, 0.018, 0.42), (2.70, 0.02, 0.35)]:
        rays = 1 - (1 - rays) * (1 - st * np.exp(-((ang - a0) / wdt) ** 2))
    rays *= np.clip((dist - S(250)) / S(300), 0, 1) * np.exp(-np.clip(dist - S(700), 0, None) / S(900))
    rays *= 0.7 + 0.3 * p.noise2d(S(120), 3, seed + 61)
    np.multiply(p.D, 1 - 0.75 * rays, out=p.D)
    p.over(p.R, 0.10 * rays)
    glow = np.exp(-((XD - 1500) ** 2 + (YD + 40) ** 2) / (2 * 380 ** 2))
    np.multiply(p.D, 1 - 0.5 * glow, out=p.D)
    p.over(p.R, 0.08 * glow)
    p.snap('sun rays')

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
