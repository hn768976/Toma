"""Mountain lake at dusk — Ink wash (水墨), painted with vendor lib/inkpaint.py `Painting`.

python scripts/scenes/inkwash_lake.py out.png [W H]
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
import numpy as np

import drawkit
from drawkit import Scaler, seed_all, save_png
from inkpaint import Painting, spline, curve, blur

STYLE = "Ink wash · 水墨"
LIB = "inkpaint"

HORIZON = 640


def paint(W=1920, H=1080, seed=1, stages_dir=None):
    seed_all(seed)
    S = Scaler(W, H)
    s = S.s
    p = Painting(W, H, seed=seed)
    rng = p.rng
    YY, XX = p.YY, p.XX
    hz = S(HORIZON)

    p.paper(fibers=int(2600 * s * s))
    p.stage('paper')

    # ---- dusk sky: ink wash darker high up, paper left bare low down, a faint vermilion
    # glow (thin R density reads as peach/rose on the paper) behind the far range
    SX, SY = S(1240), S(560)
    t = np.clip(1 - YY / hz, 0, 1)
    sky = 0.24 * t ** 1.5 * (0.62 + 0.38 * p.noise2d(S(240), 4, seed + 3))
    dist = np.hypot(XX - SX, (YY - SY) * 1.6)
    sky *= 1 - 0.75 * np.exp(-dist / S(420))
    sky *= np.clip((hz - YY) / S(40), 0, 1)
    p.over(p.D, sky)
    glow = 0.30 * np.exp(-(dist / S(560)) ** 2) + 0.12 * np.exp(-((YY - S(600)) / S(170)) ** 2)
    glow *= (YY < hz)
    p.over(p.R, glow * (0.8 + 0.2 * p.noise2d(S(160), 3, seed + 4)))
    p.stage('sky')

    # ---- far range: pale, hazy, highest peak at x~1250, irregular ridge
    far = p.ridge(S(640), peaks=[(S(180), S(250), S(220)), (S(560), S(290), S(240)), (S(900), S(240), S(200)),
                                 (S(1250), S(330), S(190)), (S(1560), S(270), S(230)), (S(1850), S(230), S(200))],
                  rough=S(18), rough_scale=S(150), seed=seed + 11)
    p.wash(far, dens=0.34, decay=S(240), tex=S(110), edge=0.3, mist_y=S(615), mist_h=S(55), seed=seed + 12)
    p.ridge_line(far, S(980), S(1500), width=S(1.6), ink=0.14)
    p.stage('far mountains')

    # ---- near range: darker, lower, big left shoulder dipping to the right
    near = p.ridge(S(650), peaks=[(S(80), S(210), S(260)), (S(420), S(220), S(300)), (S(820), S(150), S(220)),
                                  (S(1150), S(60), S(180)), (S(1700), S(90), S(220))],
                   rough=S(16), rough_scale=S(120), seed=seed + 21)
    p.wash(near, dens=0.82, decay=S(300), tex=S(90), edge=0.45, mist_y=S(625), mist_h=S(45), seed=seed + 22)
    p.cun(near, S(30), S(950), n=int(70 * s), shadow_x=S(420), spread=S(45), max_y=S(600), ink=0.16)
    # cun() uses unscaled stroke lengths/widths; at small sizes it is a bit heavy but stays in idiom
    for _ in range(28):
        x = rng.uniform(S(40), S(900))
        p.dot(x, near[int(x)] + rng.uniform(S(2), S(16)), S(rng.uniform(1.6, 3.0)), 0.6)
    np.multiply(p.D, 1 - np.clip((YY - hz) / S(3), 0, 1), out=p.D)   # everything stops at the waterline
    np.multiply(p.R, 1 - np.clip((YY - hz) / S(3), 0, 1), out=p.R)
    # the sun sits behind the ranges: wipe vermilion where mountain ink lies
    np.multiply(p.R, 1 - np.clip((YY - np.minimum(far, near)[None, :]) / S(3), 0, 1) * (YY < hz), out=p.R)
    p.stage('near mountains')

    # ---- pines on the shore (small conifers: trunk stroke + stacked fan-shaped needle tufts
    # over a pale wash, the inkpaint pine idiom shrunk to the scale of a distant shore)
    def conifer(x, top, root, ink=0.7):
        h = root - top
        lean = rng.normal(0, S(3))
        p.stroke([(x, root), (x + lean, top)], S(2.4) + h * 0.012, ink * 0.9, dry=0.3, taper=(0.02, 0.6))
        tiers = int(np.clip(h / S(16), 5, 13))
        for k in range(tiers):
            f = k / (tiers - 1)                      # 0 = bottom tier, 1 = top
            ty = root - S(10) - (h - S(10)) * f
            half = (h * 0.30) * (1 - f) ** 0.9 + S(3)
            cx = x + lean * f
            p.over(p.D, 0.16 * ink * np.exp(-(((XX - cx) / (half * 0.9 + 1)) ** 2 + ((YY - ty) / (S(6) + 1)) ** 2)))
            for side in (-1, 1):
                for _ in range(3):
                    ln = half * rng.uniform(0.7, 1.05)
                    droop = ln * rng.uniform(0.15, 0.4)
                    p.stroke(spline([(cx, ty - S(2)), (cx + side * ln * 0.55, ty + droop * 0.35),
                                     (cx + side * ln, ty + droop)], 6),
                             S(2.6) * rng.uniform(0.8, 1.2), ink * rng.uniform(0.6, 0.85), dry=0.35, taper=(0.1, 0.7))
        p.stroke([(x + lean, top - S(6)), (x + lean, top + S(14))], S(2), ink, dry=0.2, taper=(0.1, 0.4))

    left = [(70, 470, 0.55), (130, 430, 0.75), (190, 500, 0.6), (240, 420, 0.8), (300, 470, 0.7),
            (350, 520, 0.6), (395, 455, 0.78), (450, 540, 0.62), (505, 560, 0.55), (165, 545, 0.85),
            (275, 555, 0.9), (420, 580, 0.88)]
    for (x, top, ink) in left:
        conifer(S(x) + rng.normal(0, S(4)), S(top), S(650) + rng.uniform(-S(4), S(4)), ink)
    for (x, top, ink) in [(1520, 575, 0.55), (1580, 545, 0.62), (1640, 590, 0.5), (1720, 565, 0.6), (1785, 600, 0.5)]:
        conifer(S(x), S(top), S(648), ink)
    # dark shore strip that the pines root into
    shore = S(645) + S(6) * np.sin(p.xs / S(90)) + S(4)
    shore_m = ((YY > shore[None, :] - S(6)) & (YY < hz + S(8))).astype(np.float32)
    shore_m *= np.clip(1 - np.abs(XX - S(290)) / S(300), 0, 1) ** 0.5 + np.clip(1 - np.abs(XX - S(1650)) / S(190), 0, 1) ** 0.5
    p.over(p.D, 0.55 * blur(shore_m, S(2)))
    p.stage('trees')

    # ---- water: mirrored ink reflection of everything above the waterline, broken by ripples
    hzi = int(round(hz))
    depth = H - hzi
    src_rows = np.clip(2 * hzi - np.arange(hzi, H), 0, H - 1)
    refl = p.D[src_rows, :].copy()
    rippl = p.noise2d(S(30), 3, seed + 31)
    shift = ((rippl[hzi:H] - 0.5) * S(14)).astype(np.float32)
    cols = np.clip((p.xs[None, :] + shift).astype(int), 0, W - 1)
    refl = np.take_along_axis(refl, cols, axis=1)
    refl = blur(refl, S(2.5))
    fade = np.exp(-(np.arange(depth, dtype=np.float32) / S(420)))[:, None]
    refl *= 0.42 * fade * (0.8 + 0.2 * p.noise2d(S(18), 2, seed + 32)[hzi:H])
    rR = blur(p.R[src_rows, :], S(3)) * 0.5 * fade
    # water body: deepens toward the viewer
    wy = (YY[hzi:H] - hz) / (H - hz)
    body = 0.05 + 0.28 * wy ** 1.4 * (0.75 + 0.25 * p.noise2d(S(200), 3, seed + 33)[hzi:H])
    Dw = p.D[hzi:H]
    p.over(Dw, refl)
    p.over(Dw, body)
    p.over(p.R[hzi:H], rR)
    for _ in range(46):
        x = rng.uniform(S(40), S(1880)); y = rng.uniform(hz + S(18), S(1060))
        if S(980) < x < S(1360) and S(770) < y < S(860):
            continue
        ln = rng.uniform(S(50), S(170)) * (0.5 + (y - hz) / S(400))
        p.stroke(spline([(x, y), (x + ln / 2, y + rng.normal(0, S(1.2))), (x + ln, y)], 8),
                 S(1.5), 0.12 + 0.16 * (y - hz) / (H - hz), dry=0.6, taper=(0.3, 0.3))
    # pale broken strokes of the sun's reflection
    for i in range(10):
        y = hz + S(20) + i * S(20) + rng.normal(0, S(3))
        half = S(70) * (1 - i / 12) + rng.uniform(-S(10), S(10))
        p.stroke(spline([(SX - half, y), (SX + rng.normal(0, S(8)), y), (SX + half, y)], 8), S(1.6), 0.28 * (1 - i / 12),
                 dry=0.5, taper=(0.3, 0.3), red=True)
    p.stage('water')

    # ---- boat (centre-right, waterline y=800, ~180 px) with a seated rower
    BX, BY = S(1170), S(800)
    hull = spline(S.pts([(1080, 786), (1120, 804), (1200, 806), (1262, 782)]), 12)
    p.stroke(hull, S(8), 0.85, dry=0.2, taper=(0.1, 0.2))
    p.stroke(spline(S.pts([(1088, 788), (1170, 796), (1254, 784)]), 10), S(2.4), 0.55, dry=0.35)
    FX, FY = S(1150), S(790)
    p.stroke(spline([(FX - S(4), FY), (FX - S(1), FY - S(18)), (FX + S(3), FY - S(30))], 8), S(7), 0.82, dry=0.2, taper=(0.1, 0.3))
    p.stroke(spline([(FX - S(14), FY - S(32)), (FX + S(3), FY - S(46)), (FX + S(18), FY - S(31))], 8), S(3.2), 0.85, dry=0.15, taper=(0.1, 0.1))
    p.stroke(spline([(FX + S(2), FY - S(18)), (FX + S(40), FY - S(4)), (FX + S(80), FY + S(26))], 10), S(1.8), 0.7, dry=0.2, taper=(0.05, 0.3))
    # reflection of the boat: broken pale inverted hull
    for k, yy in enumerate((812, 822, 834)):
        p.stroke(spline(S.pts([(1092 + k * 10, yy), (1170, yy + 6 - k * 2), (1250 - k * 12, yy - 4)]), 10),
                 S(3.2 - k), 0.32 - 0.07 * k, dry=0.6, taper=(0.3, 0.3))
    p.stroke(spline(S.pts([(1150, 830), (1152, 852), (1154, 870)]), 8), S(4), 0.2, dry=0.6, taper=(0.2, 0.4))
    p.stroke(spline([(BX - S(150), BY + S(26)), (BX, BY + S(34)), (BX + S(150), BY + S(24))], 10), S(1.4), 0.18, dry=0.6)
    p.stage('boat')

    # ---- birds, upper right
    for (bx, by, sc) in [(1380, 250, 1.0), (1440, 225, 0.85), (1505, 262, 0.7), (1585, 205, 0.9), (1660, 240, 0.6)]:
        bx, by, sc = S(bx), S(by), sc * s
        p.stroke(curve((bx - 15 * sc, by), (bx, by + 2 * sc), -7 * sc, 8), S(2.0), 0.75, dry=0.2)
        p.stroke(curve((bx, by + 2 * sc), (bx + 15 * sc, by - 2 * sc), -7 * sc, 8), S(2.0), 0.75, dry=0.2)
    p.stage('birds')

    # ---- mist over the water, thicker on the left
    m = np.exp(-((YY - S(650) - S(40) * (p.noise2d(S(380), 3, seed + 41) - 0.5)) / S(42)) ** 2)
    m *= 0.55 + 0.45 * p.noise2d(S(160), 3, seed + 42)
    m *= 0.45 + 0.55 * np.clip(1 - XX / S(1500), 0, 1)
    np.multiply(p.D, 1 - 0.82 * m, out=p.D)
    np.multiply(p.R, 1 - 0.6 * m, out=p.R)
    p.stage('mist')

    # ---- reeds, lower-left foreground
    for i in range(18):
        back = i < 6
        x0 = rng.uniform(S(-10), S(300)); y0 = H + S(5)
        h = rng.uniform(S(100), S(200))
        lean = rng.uniform(-S(25), S(30))
        top = (x0 + lean, y0 - h)
        stem = spline([(x0, y0), (x0 + lean * 0.35 + rng.normal(0, S(3)), y0 - h * 0.5), top], 10)
        p.stroke(stem, S(rng.uniform(1.6, 2.6)), rng.uniform(0.18, 0.3) if back else rng.uniform(0.5, 0.75),
                 dry=0.4, taper=(0.02, 0.7))
        k = int(rng.integers(5, 15)); q = stem[k]
        side = rng.choice([-1, 1]); ln = rng.uniform(S(30), S(70))
        p.stroke(spline([tuple(q), (q[0] + side * ln * 0.5, q[1] - ln * 0.35), (q[0] + side * ln, q[1] - ln * 0.05)], 8),
                 S(rng.uniform(3, 4.5)), rng.uniform(0.15, 0.25) if back else rng.uniform(0.4, 0.65), dry=0.45, taper=(0.05, 0.9))
    p.stage('reeds')

    img = p.composite()
    if stages_dir:
        os.makedirs(stages_dir, exist_ok=True)
        for i, (name, im) in enumerate(p.stages):
            save_png(im, os.path.join(stages_dir, f"{i:02d}_{name.replace(' ', '_')}.png"))
    return img.convert('RGB')


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else 'inkwash_lake.png'
    W = int(sys.argv[2]) if len(sys.argv) > 2 else 1920
    H = int(sys.argv[3]) if len(sys.argv) > 3 else 1080
    save_png(paint(W, H), out)
    print('saved', out)
