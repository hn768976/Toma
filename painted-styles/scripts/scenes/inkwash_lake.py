"""Mountain lake at dusk — Ink wash (水墨), painted with vendor lib/inkpaint.py `Painting`.

python scripts/scenes/inkwash_lake.py out.png [W H [colourway [bleed]]]
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np

import drawkit
from drawkit import Scaler, seed_all, save_png
from inkpaint import spline, curve, blur
from inkwash_kit import Ink, conifer, bird, depth_mask, STYLE, COLOURWAYS

LIB = "inkpaint"
GROUPS = ("sky", "clouds", "far", "near", "water", "mist", "boat", "birds", "reeds")
HORIZON = 640
LAST = {}          # footprints of the last paint() (used by the independence check)


def paint(W=1920, H=1080, seed=1, colourway="BlackInk", bleed=0.0, include=None,
          stages_dir=None, dense_stages=False):
    seed_all(seed)
    S = Scaler(W, H, bleed)
    s = S.s
    inc = set(GROUPS) if include is None else set(include)
    p = Ink(S, seed=seed, colourway=colourway, stages_dir=stages_dir, dense=dense_stages, track_full=True)
    YY, XX, YD, XD = p.YY, p.XX, p.YD, p.XD
    CW, CH = S.W, S.H
    hz = S.y(HORIZON)
    hzi = int(round(hz))
    below_hz = np.clip((YY - hz) / max(1.0, S(3)), 0, 1)
    above_hz = 1 - below_hz

    p.setup_paper()
    p.snap('paper', dense=False)

    # ridgelines are cheap 1D curves: computed up front so any group may use them
    far = p.ridge(S.y(640), peaks=[(S.x(180), S(250), S(220)), (S.x(560), S(290), S(240)), (S.x(900), S(240), S(200)),
                                   (S.x(1250), S(330), S(190)), (S.x(1560), S(270), S(230)), (S.x(1850), S(230), S(200)),
                                   (S.x(-330), S(240), S(180)), (S.x(2250), S(250), S(180))],  # carry on into the bleed
                  rough=S(18), rough_scale=S(150), seed=seed + 11)
    near = p.ridge(S.y(650), peaks=[(S.x(80), S(210), S(260)), (S.x(420), S(220), S(300)), (S.x(820), S(150), S(220)),
                                    (S.x(1150), S(60), S(180)), (S.x(1700), S(90), S(220)),
                                    (S.x(-330), S(190), S(190))],
                   rough=S(16), rough_scale=S(120), seed=seed + 21)
    SX, SY = S.x(1240), S.y(560)

    # ================================================================ sky
    p.begin('sky', 'sky' in inc)
    t = np.clip(1 - YD / HORIZON, 0, 1.25)
    sky = 0.24 * t ** 1.5 * (0.62 + 0.38 * p.noise2d(S(240), 4, seed + 3))
    dist = np.hypot(XX - SX, (YY - SY) * 1.6)
    sky *= 1 - 0.75 * np.exp(-dist / S(420))
    sky *= np.clip((hz - YY) / S(40), 0, 1)
    p.over(p.D, sky)
    p.snap('sky wash')
    glow = 0.30 * np.exp(-(dist / S(560)) ** 2) + 0.12 * np.exp(-((YD - 600) / 170) ** 2)
    glow *= (YY < hz)
    p.over(p.R, glow * (0.8 + 0.2 * p.noise2d(S(160), 3, seed + 4)))
    p.snap('sky glow', dense=False)
    p.end()

    # ================================================================ clouds: thin dusk streaks
    rng = p.begin('clouds', 'clouds' in inc)
    cn = p.noise2d(S(90), 3, seed + 51)
    for (cx, cy, ln, th, dens) in [(420, 150, 520, 9, 0.16), (980, 205, 420, 7, 0.13), (1540, 120, 600, 10, 0.15),
                                   (700, 270, 300, 6, 0.10), (1760, 300, 260, 5, 0.09)]:
        x0, x1 = int(max(0, S.x(cx - ln))), int(min(CW, S.x(cx + ln) + 1))
        y0, y1 = int(max(0, S.y(cy - 60))), int(min(CH, S.y(cy + 60) + 1))
        xd, yd = XD[y0:y1, x0:x1], YD[y0:y1, x0:x1]
        u = (xd - cx) / ln                                   # -1..1 along the streak
        wave = 10 * np.sin(u * 2.6 + cx * 0.01) - 6 * u      # gentle droop
        env = np.clip(1 - u ** 2, 0, 1) ** 1.3
        c = np.exp(-((yd - cy - wave) / th) ** 2) * env * (0.45 + 0.55 * cn[y0:y1, x0:x1])
        p.over(p.D[y0:y1, x0:x1], dens * c)
        # warm underside: the glow catches the cloud's lower edge
        under = np.exp(-((yd - cy - wave - th * 0.9) / (th * 0.8)) ** 2) * env
        p.over(p.R[y0:y1, x0:x1], 0.16 * under * (0.6 + 0.4 * cn[y0:y1, x0:x1]))
        # one or two dry wisps riding the streak
        for k in range(2):
            a = rng.uniform(-0.8, 0.2); b = a + rng.uniform(0.35, 0.7)
            pts = [(S.x(cx + ln * v), S.y(cy + 10 * np.sin(v * 2.6 + cx * 0.01) - 6 * v + rng.normal(0, th * 0.25)))
                   for v in np.linspace(a, b, 5)]
            p.stroke(spline(pts, 8), S(1.2), dens * 0.55, dry=0.7, taper=(0.45, 0.45))
        p.snap('cloud')
    p.end()

    # ================================================================ far range
    p.begin('far', 'far' in inc)
    p.wash(far, dens=0.34, decay=S(240), tex=S(110), edge=0.3, mist_y=S.y(615), mist_h=S(55), seed=seed + 12)
    p.snap('far wash')
    p.ridge_line(far, S.x(980), S.x(1500), width=S(1.6), ink=0.14)
    np.multiply(p.D, above_hz, out=p.D)
    p.occlude(depth_mask(p, far, hz), np.clip((YY - far[None, :]) / S(3), 0, 1) * (YY < hz))
    p.snap('far ridge', dense=False)
    p.end()

    # ================================================================ near range + pines + shore
    rng = p.begin('near', 'near' in inc)
    p.wash(near, dens=0.82, decay=S(300), tex=S(90), edge=0.45, mist_y=S.y(625), mist_h=S(45), seed=seed + 22)
    p.snap('near wash')
    p.cun(near, S.x(30), S.x(500), n=int(40 * s), shadow_x=S.x(420), spread=S(45), max_y=S.y(600), ink=0.16)
    p.snap('cun left')
    p.cun(near, S.x(380), S.x(950), n=int(30 * s), shadow_x=S.x(420), spread=S(45), max_y=S.y(600), ink=0.16)
    for _ in range(28):
        x = rng.uniform(S.x(40), S.x(900))
        p.dot(x, near[int(x)] + rng.uniform(S(2), S(16)), S(rng.uniform(1.6, 3.0)), 0.6)
    np.multiply(p.D, above_hz, out=p.D)
    p.snap('cun and moss')

    left = [(70, 470, 0.55), (130, 430, 0.75), (190, 500, 0.6), (240, 420, 0.8), (300, 470, 0.7),
            (350, 520, 0.6), (395, 455, 0.78), (450, 540, 0.62), (505, 560, 0.55), (165, 545, 0.85),
            (275, 555, 0.9), (420, 580, 0.88)]
    for i, (x, top, ink) in enumerate(left):
        conifer(p, S.x(x) + rng.normal(0, S(4)), S.y(top), S.y(650) + rng.uniform(-S(4), S(4)), ink,
                wind=0.25, halo=1.0)
        p.snap(f'pine {i + 1}')
    for i, (x, top, ink) in enumerate([(1520, 575, 0.55), (1580, 545, 0.62), (1640, 590, 0.5), (1720, 565, 0.6), (1785, 600, 0.5)]):
        conifer(p, S.x(x), S.y(top), S.y(648), ink, wind=0.25, halo=0.8)
        p.snap(f'right pine {i + 1}')
    shore = S.y(645) + S(6) * np.sin(XD[0] / 90) + S(4)
    shore_m = ((YY > shore[None, :] - S(6)) & (YY < hz + S(8))).astype(np.float32)
    shore_m *= np.clip(1 - np.abs(XD - 290) / 300, 0, 1) ** 0.5 + np.clip(1 - np.abs(XD - 1650) / 190, 0, 1) ** 0.5
    p.over(p.D, 0.55 * blur(shore_m, S(2)))
    p.occlude(depth_mask(p, near, hz), np.clip((YY - near[None, :]) / S(3), 0, 1) * (YY < hz))
    p.snap('shore', dense=False)
    p.end()

    # ================================================================ water + reflections
    rng = p.begin('water', 'water' in inc)
    Hb = S.y(1080)                                   # design bottom (water keeps deepening into the bleed)
    rows = np.arange(hzi, CH)
    src_rows = np.clip(2 * hzi - rows, 0, CH - 1)
    refl = p.FD[src_rows, :].copy()                  # reflect the full back stack, included or not
    rippl = p.noise2d(S(30), 3, seed + 31)
    shift = ((rippl[hzi:CH] - 0.5) * S(14)).astype(np.float32)
    cols = np.clip((p.xs[None, :] + shift).astype(int), 0, CW - 1)
    refl = np.take_along_axis(refl, cols, axis=1)
    refl = blur(refl, S(2.5))
    fade = np.exp(-((rows - hzi).astype(np.float32) / S(420)))[:, None]
    refl *= 0.42 * fade * (0.8 + 0.2 * p.noise2d(S(18), 2, seed + 32)[hzi:CH])
    rR = blur(p.FR[src_rows, :], S(3)) * 0.5 * fade
    wy = np.clip((YY[hzi:CH] - hz) / (Hb - hz), 0, 1.2)
    body = 0.05 + 0.28 * wy ** 1.4 * (0.75 + 0.25 * p.noise2d(S(200), 3, seed + 33)[hzi:CH])
    Dw = p.D[hzi:CH]
    p.over(Dw, refl)
    p.snap('reflections')
    p.over(Dw, body)
    p.over(p.R[hzi:CH], rR)
    p.snap('water body')
    ys = rng.uniform(HORIZON + 18, 1060, 46); xs_ = rng.uniform(40, 1880, 46)
    order = np.argsort(ys)                           # far ripples first
    for b in range(3):
        for j in order[b * 16:(b + 1) * 16]:
            xdd, ydd = xs_[j], ys[j]
            if 980 < xdd < 1360 and 770 < ydd < 860:
                continue
            ln = rng.uniform(50, 170) * (0.5 + (ydd - HORIZON) / 400)
            x, y = S.x(xdd), S.y(ydd)
            p.stroke(spline([(x, y), (x + S(ln) / 2, y + rng.normal(0, S(1.2))), (x + S(ln), y)], 8),
                     S(1.5), 0.12 + 0.16 * (ydd - HORIZON) / (1080 - HORIZON), dry=0.6, taper=(0.3, 0.3))
        p.snap(f'ripples {b + 1}')
    for i in range(10):
        y = hz + S(20) + i * S(20) + rng.normal(0, S(3))
        half = S(70) * (1 - i / 12) + rng.uniform(-S(10), S(10))
        p.stroke(spline([(SX - half, y), (SX + rng.normal(0, S(8)), y), (SX + half, y)], 8), S(1.6), 0.28 * (1 - i / 12),
                 dry=0.5, taper=(0.3, 0.3), red=True)
    p.snap('sun path', dense=False)
    p.end()

    # ================================================================ mist over the water, thicker at left
    p.begin('mist', 'mist' in inc)
    m = np.exp(-((YD - 650 - 40 * (p.noise2d(S(380), 3, seed + 41) - 0.5)) / 42) ** 2)
    m *= 0.55 + 0.45 * p.noise2d(S(160), 3, seed + 42)
    m *= 0.45 + 0.55 * np.clip(1 - XD / 1500, 0, 1)
    m[m < 0.003] = 0                                  # keep the lift strictly inside its band
    p.occlude(0.82 * m, 0.6 * m)
    p.snap('mist', dense=False)
    p.end()

    # ================================================================ boat, rower, its reflection
    p.begin('boat', 'boat' in inc)
    BX, BY = S.x(1170), S.y(800)
    hull = spline(S.pts([(1080, 786), (1120, 804), (1200, 806), (1262, 782)]), 12)
    p.stroke(hull, S(8), 0.85, dry=0.2, taper=(0.1, 0.2))
    p.stroke(spline(S.pts([(1088, 788), (1170, 796), (1254, 784)]), 10), S(2.4), 0.55, dry=0.35)
    p.snap('hull')
    FX, FY = S.x(1150), S.y(790)
    p.stroke(spline([(FX - S(4), FY), (FX - S(1), FY - S(18)), (FX + S(3), FY - S(30))], 8), S(7), 0.82, dry=0.2, taper=(0.1, 0.3))
    p.stroke(spline([(FX - S(14), FY - S(32)), (FX + S(3), FY - S(46)), (FX + S(18), FY - S(31))], 8), S(3.2), 0.85, dry=0.15, taper=(0.1, 0.1))
    p.stroke(spline([(FX + S(2), FY - S(18)), (FX + S(40), FY - S(4)), (FX + S(80), FY + S(26))], 10), S(1.8), 0.7, dry=0.2, taper=(0.05, 0.3))
    p.snap('rower')
    for k, yy in enumerate((812, 822, 834)):
        p.stroke(spline(S.pts([(1092 + k * 10, yy), (1170, yy + 6 - k * 2), (1250 - k * 12, yy - 4)]), 10),
                 S(3.2 - k), 0.32 - 0.07 * k, dry=0.6, taper=(0.3, 0.3))
    p.stroke(spline(S.pts([(1150, 830), (1152, 852), (1154, 870)]), 8), S(4), 0.2, dry=0.6, taper=(0.2, 0.4))
    p.stroke(spline([(BX - S(150), BY + S(26)), (BX, BY + S(34)), (BX + S(150), BY + S(24))], 10), S(1.4), 0.18, dry=0.6)
    p.snap('boat reflection', dense=False)
    p.end()

    # ================================================================ birds, upper right
    p.begin('birds', 'birds' in inc)
    flock = [(1380, 250, 1.0), (1440, 225, 0.85), (1505, 262, 0.7), (1585, 205, 0.9), (1660, 240, 0.6)]
    for i, (bx, by, sc) in enumerate(flock):
        bird(p, S.x(bx), S.y(by), sc * s)
        p.snap(f'bird {i + 1}', dense=i < len(flock) - 1)
    p.end()

    # ================================================================ reeds, lower-left foreground
    rng = p.begin('reeds', 'reeds' in inc)
    for i in range(18):
        back = i < 6
        x0 = S.x(rng.uniform(-10, 300)); y0 = S.y(1085)
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
        if i % 3 == 2 and i < 17:
            p.snap(f'reeds {i // 3 + 1}')
    p.snap('reeds', dense=False)
    p.end()

    LAST.clear(); LAST.update(p.footprints)
    return p.finish()


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else 'inkwash_lake.png'
    W = int(sys.argv[2]) if len(sys.argv) > 2 else 1920
    H = int(sys.argv[3]) if len(sys.argv) > 3 else 1080
    cw = sys.argv[4] if len(sys.argv) > 4 else "BlackInk"
    bl = float(sys.argv[5]) if len(sys.argv) > 5 else 0.0
    save_png(paint(W, H, colourway=cw, bleed=bl), out)
    print('saved', out)
