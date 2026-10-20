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
from inkpaint import spline, curve, blur, fbm1d
from inkwash_kit import (Ink, conifer, leafy_tree, wet_tree, bird, ink_mass, cun, dian, ridge_accent,
                         broad_stroke, wash_field, water_dashes, vnz, smooth1d, STYLE, COLOURWAYS)

LIB = "inkpaint"
GROUPS = ("sky", "clouds", "far", "near", "water", "mist", "boat", "birds", "reeds")
HORIZON = 640
SUN = (1335, 232, 30)      # pale dusk sun (design x, y, r)
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

    p.setup_paper()
    p.snap('paper', dense=False)

    # ridgelines are cheap 1D curves: computed up front so any group may use them.
    # The far range keeps to the middle and dissolves toward the right, leaving open sky.
    far = p.ridge(S.y(648), peaks=[(S.x(170), S(150), S(200)), (S.x(560), S(250), S(230)), (S.x(880), S(215), S(190)),
                                   (S.x(1215), S(300), S(170)), (S.x(1470), S(175), S(210)), (S.x(1850), S(70), S(260)),
                                   (S.x(-330), S(150), S(180)), (S.x(2250), S(60), S(180))],
                  rough=S(16), rough_scale=S(150), seed=seed + 11)
    near = p.ridge(S.y(652), peaks=[(S.x(80), S(215), S(250)), (S.x(410), S(225), S(290)), (S.x(800), S(120), S(200)),
                                    (S.x(1700), S(80), S(210)), (S.x(-330), S(190), S(190))],
                   rough=S(16), rough_scale=S(120), seed=seed + 21)
    SX, SY, SR = S.x(SUN[0]), S.y(SUN[1]), S(SUN[2])

    # ================================================================ sky: mostly bare paper
    p.begin('sky', 'sky' in inc)
    rng = p.rng
    # a pale grey wash brushed across the top, its lower edge left to dissolve unevenly
    yl = S.y(120) + fbm1d(CW, S(260), 4, p.sd()) * S(70) + fbm1d(CW, S(60), 3, p.sd()) * S(14)
    y1 = int(min(CH, yl.max() + S(40)))
    f = yl[None, :] - YY[:y1]
    wash_field(p, 0, y1, 0, CW, f, 0.08, S(70), pool=0.0)
    p.snap('sky wash')
    # dusk: a very pale vermilion wash laid wet across the lower sky, ragged at its top edge
    yt = S.y(355) + fbm1d(CW, S(300), 4, p.sd()) * S(80) + np.clip((XD[0] - 1335) / 900, -1, 1) ** 2 * S(60)
    yb = hz
    y0 = int(max(0, yt.min() - S(30)))
    f = np.minimum(YY[y0:hzi + 1] - yt[None, :], (hz - YY[y0:hzi + 1]) * 3)
    hor = 0.55 + 0.45 * np.exp(-((XD[0] - 1250) / 700) ** 2)
    a = wash_field(p, y0, hzi + 1, 0, CW, f, 1.0, S(110), pool=0.2, red=True)
    p.R[y0:hzi + 1] *= (0.15 * hor)[None, :]
    # the pale sun: one round touch of thin vermilion, its rim pooled where it dried
    p.wet_dot(SX, SY, SR, 0.2, squash=1.04, red=True, irr=0.25)
    p.snap('sky glow', dense=False)
    p.end()

    # ================================================================ clouds: a few thin wet strokes
    rng = p.begin('clouds', 'clouds' in inc)
    for (cx, cy, ln, th, dens) in [(420, 170, 430, 20, 0.075), (1040, 232, 300, 13, 0.06), (1600, 132, 470, 24, 0.08),
                                   (700, 300, 200, 10, 0.05)]:
        pieces = int(rng.integers(1, 3))
        u0 = rng.uniform(-1.0, -0.8)
        for k in range(pieces):
            u1 = min(1.0, u0 + 2.0 / pieces * rng.uniform(0.6, 1.0))
            us = np.linspace(u0, u1, 9)
            sag = rng.uniform(4, 16); tilt = rng.uniform(-8, 8)
            pts = [(S.x(cx + ln * u), S.y(cy + sag * np.sin(u * 2.4 + cx * 0.01) + tilt * u + rng.normal(0, 1.5))) for u in us]
            broad_stroke(p, pts, S(th) * rng.uniform(0.7, 1.3), dens * rng.uniform(0.8, 1.25), dry=rng.uniform(0.45, 0.8),
                         taper=(rng.uniform(0.25, 0.5), rng.uniform(0.3, 0.6)), pool=rng.uniform(0.15, 0.6), hair=0.9)
            if rng.random() < 0.6:                                    # dusk catching the underside
                pts2 = [(x_, y_ + S(th) * rng.uniform(0.25, 0.5)) for (x_, y_) in pts[2:-2]]
                broad_stroke(p, pts2, S(th) * rng.uniform(0.5, 0.8), 0.09, dry=0.5, taper=(0.4, 0.4), pool=0.2, red=True)
            u0 = u1 + rng.uniform(0.06, 0.2)
            if u0 >= 0.9:
                break
        p.snap('cloud')
    p.end()

    # ================================================================ far range
    p.begin('far', 'far' in inc)
    fcov = ink_mass(p, far, dens=0.30, reach=S(120), glazes=3, soft=1.4, pool=0.5, blooms=2, dry=0.25,
                    floor=hz, mist=(S.y(612), S(26)))
    p.snap('far wash')
    cun(p, far, S.x(1050), S.x(1420), n=int(16), shadow_x=S.x(1215), reach=S(70), ink=0.12, floor=S.y(600),
        long_frac=0.4)
    p.snap('far texture')
    np.multiply(p.D, 1 - np.clip((YY - hz) / S(2), 0, 1), out=p.D)
    p.occlude(0.97 * fcov, np.clip(fcov * 1.2, 0, 1) * (YY < hz))
    p.snap('far ridge', dense=False)
    p.end()

    # ================================================================ near range + trees + shore
    rng = p.begin('near', 'near' in inc)
    ncov = ink_mass(p, near, dens=0.75, reach=S(150), glazes=4, soft=0.9, pool=0.55, blooms=2, dry=0.35,
                    floor=hz, mist=(S.y(628), S(16)))
    p.snap('near wash')
    cun(p, near, S.x(-40), S.x(560), n=34, shadow_x=S.x(410), reach=S(110), ink=0.26, floor=S.y(612))
    p.snap('cun left')
    cun(p, near, S.x(560), S.x(960), n=16, shadow_x=S.x(800), reach=S(80), ink=0.22, floor=S.y(612))
    cun(p, near, S.x(1500), S.x(1900), n=10, shadow_x=S.x(1700), reach=S(50), ink=0.18, floor=S.y(630))
    ridge_accent(p, near, S.x(-60), S.x(700), ink=0.32, width=2.2, coverage=0.4)
    p.snap('cun right')
    dian(p, near, S.x(0), S.x(900), clusters=7, ink=0.62, depth=14, floor=S.y(620))
    dian(p, near, S.x(1560), S.x(1860), clusters=2, ink=0.5, depth=8, floor=S.y(640))
    p.snap('moss')
    # trees: a loose grove on the left shore, a few on the right spit — each painted differently
    grove = [(62, 470, 0.55, 'c'), (112, 452, 0.72, 'c'), (148, 520, 0.62, 'l'), (205, 430, 0.8, 'c'),
             (232, 548, 0.58, 'w'), (300, 488, 0.7, 'c'), (338, 560, 0.66, 'l'), (402, 470, 0.78, 'c'),
             (432, 585, 0.5, 'w'), (520, 575, 0.55, 'c'), (556, 600, 0.45, 'w')]
    for i, (x, top, ink, kind) in enumerate(grove):
        X = S.x(x) + rng.normal(0, S(6)); root = S.y(650) + rng.uniform(-S(5), S(4))
        if kind == 'c':
            conifer(p, X, S.y(top) + rng.normal(0, S(10)), root, ink, wind=0.25 + rng.normal(0, 0.15),
                    halo=rng.uniform(0.4, 1.1))
        elif kind == 'l':
            leafy_tree(p, X, S.y(top), root, ink, lean=rng.normal(0.05, 0.08))
        else:
            wet_tree(p, X, S.y(top), root, ink * 0.8, lean=0.05)
        p.snap(f'tree {i + 1}')
    for i, (x, top, ink, kind) in enumerate([(1548, 572, 0.55, 'c'), (1592, 590, 0.42, 'w'), (1655, 556, 0.6, 'l'),
                                             (1760, 602, 0.45, 'c')]):
        X, root = S.x(x), S.y(648) + rng.uniform(-S(3), S(3))
        if kind == 'c':
            conifer(p, X, S.y(top), root, ink, wind=0.25, halo=0.6)
        elif kind == 'l':
            leafy_tree(p, X, S.y(top), root, ink, lean=0.04)
        else:
            wet_tree(p, X, S.y(top), root, ink, lean=0.0)
        p.snap(f'right tree {i + 1}')
    # the shore: a few broken horizontal pulls of a loaded brush along the waterline
    for (xa, xb, k) in [(-60, 620, 5), (1490, 1860, 3)]:
        for j in range(k):
            x0 = rng.uniform(xa, xb - 80); x1 = min(xb, x0 + rng.uniform(80, 320))
            y = 644 + rng.uniform(-1, 6)
            pts = [S.pt(x_, y + rng.normal(0, 1.2)) for x_ in np.linspace(x0, x1, 5)]
            broad_stroke(p, pts, S(rng.uniform(3, 7)), rng.uniform(0.35, 0.65), dry=rng.uniform(0.35, 0.75),
                         taper=(rng.uniform(0.1, 0.4), rng.uniform(0.2, 0.5)), pool=0.4, side=rng.uniform(-0.5, 0.5))
    np.multiply(p.D, 1 - np.clip((YY - hz - S(4)) / S(2), 0, 1), out=p.D)
    p.occlude(0.97 * ncov, np.clip(ncov * 1.2, 0, 1) * (YY < hz))
    p.snap('shore', dense=False)
    p.end()

    # ================================================================ water + reflections
    rng = p.begin('water', 'water' in inc)
    Hb = S.y(1080)
    # mirrored back stack (included or not), squashed: reflections are shorter than the things
    rows = np.arange(hzi, CH)
    src_rows = np.clip(np.round(hz - (rows - hz) / 0.72).astype(int), 0, CH - 1)
    refl = p.FD[src_rows, :]
    fade = np.exp(-((rows - hzi).astype(np.float32) / S(190)))[:, None]
    # each brushed band of the reflection sits a little sideways of the next, and the far crest
    # is not re-drawn: the reflection is a soft, simplified wash broken into horizontal pulls
    bands = ((rows - hzi) / S(rng.uniform(3, 4))).astype(int)
    off = (rng.normal(0, 1, bands.max() + 1) * S(5)).astype(np.float32)[bands]
    cols = np.clip((p.xs[None, :] + off[:, None]).astype(int), 0, CW - 1)
    refl = np.take_along_axis(refl, cols, axis=1)
    refl = blur(refl, S(3))
    # 1) a pale wash version of it: simplified sideways, broken into horizontal bands
    Yw, Xw = YY[hzi:CH], XX[hzi:CH]
    band = vnz(rng, Yw, Xw, S(3.2), S(140), 2)
    pale = refl * fade * 0.36 * np.clip(0.7 + 0.6 * band, 0, 1)
    pale *= np.clip(1 + 0.4 * vnz(rng, Yw, Xw, S(2.5), S(40), 1), 0, 2)
    Dw = p.D[hzi:CH]
    p.over(Dw, pale)
    p.snap('reflection wash')
    # 2) the dark things (trees, the near hill) re-stated with broken horizontal brush pulls
    ry = hzi + S(3)
    n_str = 0
    while ry < hzi + S(150) and n_str < 160:
        r = int(ry) - hzi
        if r >= len(rows):
            break
        prof = smooth1d(refl[r], S(3)) * float(fade[r, 0])
        on = prof > 0.3
        xs_on = np.flatnonzero(np.diff(on.astype(np.int8)) != 0)
        edges = np.concatenate([[0] if on[0] else [], xs_on + 1, [CW] if on[-1] else []]).astype(int)
        for a_, b_ in zip(edges[::2], edges[1::2]):
            if b_ - a_ < S(6):
                continue
            x0 = a_ + rng.uniform(0, 0.25) * (b_ - a_); x1 = b_ - rng.uniform(0, 0.25) * (b_ - a_)
            pieces = int(rng.integers(1, 4))
            xa = x0
            for q in range(pieces):
                xe = xa + (x1 - xa) * (rng.uniform(0.4, 1.0) if q < pieces - 1 else 1.0)
                if xe - xa > S(5):
                    ink = float(prof[int((xa + xe) / 2)]) * rng.uniform(0.35, 0.65)
                    yy = ry + rng.normal(0, S(0.8))
                    p.stroke([(xa, yy), ((xa + xe) / 2, yy + rng.normal(0, S(0.8))), (xe, yy + rng.normal(0, S(0.6)))],
                             S(rng.uniform(1.4, 3.6)), ink, dry=rng.uniform(0.45, 0.85), taper=(0.15, 0.3), jitter=0.6)
                    n_str += 1
                xa = xe + S(rng.uniform(4, 22))
                if xa >= x1:
                    break
        ry += S(rng.uniform(4, 11)) * (1 + (ry - hzi) / S(120))
    p.snap('reflection strokes')
    # 3) the water itself: mostly bare paper, a pale wash pulled across near the bottom
    for k, (yc, hh, dens) in enumerate([(1000, 70, 0.10), (905, 22, 0.06)]):
        top = S.y(yc - hh) + fbm1d(CW, S(240), 4, p.sd()) * S(18)
        y0 = int(max(hzi, top.min() - S(30)))
        f = np.minimum(YY[y0:CH] - top[None, :], S(hh * 2) + S(1200) * (k == 0))
        f = np.minimum(f, (S.y(yc + hh) + fbm1d(CW, S(200), 3, p.sd())[None, :] * S(14) - YY[y0:CH]) + S(1200) * (k == 0))
        wash_field(p, y0, CH, 0, CW, f, dens, S(60), pool=0.35)
    p.snap('water body')
    water_dashes(p, S.y(HORIZON + 16), S.y(1070), S.x(S.X0), S.x(S.X1), clusters=7, ink=0.30,
                 avoid=[(S.x(1040), S.y(760), S.x(1340), S.y(880)), (S.x(-200), S.y(900), S.x(330), S.y(1200))])
    p.snap('ripples 1')
    water_dashes(p, S.y(HORIZON + 10), S.y(800), S.x(600), S.x(1500), clusters=4, ink=0.22,
                 avoid=[(S.x(1040), S.y(760), S.x(1340), S.y(880))], persp=(0.4, 0.9))
    p.snap('ripples 2')
    # the sun's path: a few broken pale strokes under the sun
    y = hz + S(14)
    while y < hz + S(200):
        f = (y - hz) / S(200)
        half = SR * rng.uniform(0.6, 1.6) * (1.2 - 0.6 * f)
        cx = SX + rng.normal(0, S(6))
        if rng.random() < 0.8:
            p.stroke(spline([(cx - half, y), (cx + rng.normal(0, S(4)), y + rng.normal(0, S(0.8))), (cx + half, y)], 8),
                     S(rng.uniform(0.8, 1.8)), 0.22 * (1 - 0.6 * f) * rng.uniform(0.5, 1.1), dry=rng.uniform(0.5, 0.85),
                     taper=(0.3, 0.3), red=True)
        y += S(rng.uniform(8, 26))
    p.snap('sun path', dense=False)
    p.end()

    # ================================================================ mist: bare paper reserved over the water's edge
    p.begin('mist', 'mist' in inc)
    rng = p.rng
    y0, y1 = int(max(0, S.y(560))), int(min(CH, S.y(740)))
    Ym, Xm = YY[y0:y1], XX[y0:y1]
    wob = fbm1d(CW, S(380), 3, p.sd())[None, :] * S(22)
    half = (S(14) + S(30) * np.clip(0.5 + fbm1d(CW, S(260), 3, p.sd()), 0, 1) * np.clip(1.25 - XD[0] / 1500, 0.3, 1))[None, :]
    mz = vnz(rng, Ym, Xm, S(14), S(70), 3)
    m = np.clip((half - np.abs(Ym - S.y(648) - wob) + mz * S(8)) / S(16), 0, 1)
    m = m * np.clip(0.75 + 0.25 * vnz(rng, Ym, Xm, S(30), S(160), 2), 0, 1)
    m[m < 0.003] = 0
    occ = np.zeros_like(p.D); occ[y0:y1] = 0.85 * m
    p.occlude(occ, 0.6 * occ)
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

    # ================================================================ birds, upper right: a loose, uneven flock
    rng = p.begin('birds', 'birds' in inc)
    flock = [(1395, 262, 1.0), (1452, 238, 0.82), (1478, 276, 0.62), (1590, 214, 0.9), (1672, 252, 0.55), (1712, 236, 0.45)]
    for i, (bx, by, sc) in enumerate(flock):
        bird(p, S.x(bx + rng.normal(0, 6)), S.y(by + rng.normal(0, 5)), sc * s * rng.uniform(0.85, 1.15))
        p.snap(f'bird {i + 1}', dense=i < len(flock) - 1)
    p.end()

    # ================================================================ reeds, lower-left foreground
    rng = p.begin('reeds', 'reeds' in inc)
    for i in range(18):
        back = i < 6
        x0 = S.x(rng.uniform(-10, 300)); y0 = S.y(max(1085, S.Y1 + 5))
        h = rng.uniform(S(100), S(200)) + (y0 - S.y(1085))
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
