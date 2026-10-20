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
from inkwash_kit import (Ink, conifer, leafy_tree, bird, ink_mass, cun_bold, dian, ridge_accent, broad_stroke,
                         wash_field, ripples, brush, wet_disc, fill_poly, fibre_bleed, vnz, sstep, smooth1d, STYLE,
                         COLOURWAYS)

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
    y1 = int(min(CH, yl.max() + S(70)))
    f = yl[None, :] - YY[:y1]
    wash_field(p, 0, y1, 0, CW, f, 0.08, S(45), pool=0.25, ramp=S(9))
    p.snap('sky wash')
    # dusk: a very pale vermilion wash laid wet across the lower sky, ragged at its top edge
    yt = S.y(355) + fbm1d(CW, S(300), 4, p.sd()) * S(80) + np.clip((XD[0] - 1335) / 900, -1, 1) ** 2 * S(60)
    yb = hz
    y0 = int(max(0, yt.min() - S(80)))
    f = np.minimum(YY[y0:hzi + 1] - yt[None, :], (hz - YY[y0:hzi + 1]) * 3)
    hor = 0.55 + 0.45 * np.exp(-((XD[0] - 1250) / 700) ** 2)
    a = wash_field(p, y0, hzi + 1, 0, CW, f, 1.0, S(55), pool=0.2, red=True, ramp=S(14))
    p.R[y0:hzi + 1] *= (0.15 * hor)[None, :]
    # the pale sun: one wet round touch of thin vermilion — wandering outline, pigment settled
    # unevenly, a broken tide line, and a little bleed into the fibre on its wetter side
    wet_disc(p, SX, SY, SR, 0.2, red=True, wet_dir=2.3)
    p.snap('sky glow', dense=False)
    p.end()

    # ================================================================ clouds: a few thin wet strokes
    rng = p.begin('clouds', 'clouds' in inc)
    # three clouds, each made differently: a pale wet smear with tide lines, a dry side-brush pull
    # breaking into flying white, and a faint vermilion wash low by the sun
    cx, cy, ln, th = S.x(430), S.y(176), S(300), S(16)
    x0, x1 = int(max(0, cx - ln - S(60))), int(min(CW, cx + ln + S(60)))
    y0, y1 = int(max(0, cy - th * 4)), int(min(CH, cy + th * 4))
    Yc, Xc = YY[y0:y1, x0:x1], XX[y0:y1, x0:x1]
    u = (Xc - cx) / ln
    belly = th * (1 - np.clip(np.abs(u), 0, 1.2) ** 1.6) * (1 + 0.5 * np.clip(-u, 0, 1))
    fcl = belly - np.abs(Yc - cy - S(9) * u ** 2 + S(5) * u)
    wash_field(p, y0, y1, x0, x1, fcl, 0.07, S(22), pool=0.6, ramp=S(3))
    brush(p, [(cx - ln * 0.7, cy - th * 0.5), (cx - ln * 0.1, cy - th * 0.85), (cx + ln * 0.55, cy - th * 0.3)],
          S(7), 0.07, dry=0.7, taper=(0.3, 0.5), swell=0.4, hair=1.2)
    p.snap('cloud')
    for k, (xa, xb, yy, w, dk) in enumerate([(1395, 1830, 128, 15, 0.085), (1520, 1700, 150, 7, 0.06)]):
        pts = [S.pt(xa, yy + rng.normal(0, 2)), S.pt((2 * xa + xb) / 3, yy - 4 + rng.normal(0, 2)),
               S.pt((xa + 2 * xb) / 3, yy + 3 + rng.normal(0, 2)), S.pt(xb, yy - 6)]
        brush(p, pts, S(w), dk, dry=rng.uniform(0.6, 0.8), taper=(0.08, 0.6), swell=0.5, pv=0.3, hair=1.25,
              pool=0.4, side=rng.uniform(-0.8, 0.8), rough=1.4)
    p.snap('cloud')
    cx, cy = S.x(1090), S.y(300)
    x0, x1 = int(max(0, cx - S(220))), int(min(CW, cx + S(220)))
    y0, y1 = int(max(0, cy - S(40))), int(min(CH, cy + S(40)))
    Yc, Xc = YY[y0:y1, x0:x1], XX[y0:y1, x0:x1]
    fcl = S(9) * (1 - ((Xc - cx) / S(170)) ** 2) - np.abs(Yc - cy + S(6) * (Xc - cx) / S(170))
    wash_field(p, y0, y1, x0, x1, fcl, 0.10, S(16), pool=0.5, ramp=S(2.5), red=True)
    p.snap('cloud')
    p.end()

    # ================================================================ far range
    p.begin('far', 'far' in inc)
    fcov = ink_mass(p, far, dens=0.30, reach=S(120), glazes=3, soft=1.4, pool=0.5, blooms=2, dry=0.25,
                    floor=hz, mist=(S.y(612), S(26)))
    p.snap('far wash')
    cun_bold(p, far, S.x(1050), S.x(1420), n=6, shadow_x=S.x(1215), reach=S(70), ink=0.2, floor=S.y(600),
             width=(3, 7), length=(40, 110))
    p.snap('far texture')
    np.multiply(p.D, 1 - np.clip((YY - hz) / S(2), 0, 1), out=p.D)
    p.occlude(0.97 * fcov, np.clip(fcov * 1.2, 0, 1) * (YY < hz))
    p.snap('far ridge', dense=False)
    p.end()

    # ================================================================ near range + trees + shore
    rng = p.begin('near', 'near' in inc)
    ncov = ink_mass(p, near, dens=0.62, reach=S(150), glazes=4, soft=0.9, pool=0.5, blooms=1, dry=0.08,
                    floor=hz, mist=(S.y(628), S(16)))
    p.snap('near wash')
    # a few deliberate side-brush texture strokes, not a hatch
    cun_bold(p, near, S.x(-40), S.x(560), n=12, shadow_x=S.x(410), reach=S(110), ink=0.62, floor=S.y(612),
             width=(5, 13), length=(50, 170))
    p.snap('cun left')
    cun_bold(p, near, S.x(560), S.x(960), n=6, shadow_x=S.x(800), reach=S(80), ink=0.5, floor=S.y(612),
             width=(3, 8), length=(35, 110))
    cun_bold(p, near, S.x(1500), S.x(1900), n=4, shadow_x=S.x(1700), reach=S(50), ink=0.45, floor=S.y(630),
             width=(3, 7), length=(25, 70))
    ridge_accent(p, near, S.x(-60), S.x(700), ink=0.32, width=2.2, coverage=0.4)
    p.snap('cun right')
    dian(p, near, S.x(0), S.x(900), clusters=7, ink=0.62, depth=14, floor=S.y(620))
    dian(p, near, S.x(1560), S.x(1860), clusters=2, ink=0.5, depth=8, floor=S.y(640))
    p.snap('moss')
    # trees: a loose grove on the left shore, a few on the right spit — each painted differently
    grove = [(58, 478, 0.6, 'c'), (118, 446, 0.74, 'c'), (150, 524, 0.62, 'l'), (212, 422, 0.82, 'c'),
             (246, 556, 0.6, 'l'), (296, 494, 0.7, 'c'), (346, 548, 0.68, 'l'), (404, 462, 0.8, 'c'),
             (446, 592, 0.62, 'c'), (521, 572, 0.6, 'c'), (562, 606, 0.55, 'l')]
    for i, (x, top, ink, kind) in enumerate(grove):
        X = S.x(x) + rng.normal(0, S(6)); root = S.y(650) + rng.uniform(-S(5), S(4))
        if kind == 'c':
            conifer(p, X, S.y(top) + rng.normal(0, S(10)), root, ink, wind=0.25 + rng.normal(0, 0.15),
                    halo=rng.uniform(0.0, 0.5), style=('brush', 'brush', 'mixed', 'brush')[i % 4])
        else:
            leafy_tree(p, X, S.y(top), root, ink, lean=rng.normal(0.05, 0.08))
        p.snap(f'tree {i + 1}')
    for i, (x, top, ink, kind) in enumerate([(1548, 572, 0.55, 'c'), (1596, 596, 0.5, 'l'), (1655, 556, 0.6, 'l'),
                                             (1760, 602, 0.5, 'c')]):
        X, root = S.x(x), S.y(648) + rng.uniform(-S(3), S(3))
        if kind == 'c':
            conifer(p, X, S.y(top), root, ink, wind=0.25, halo=0.2)
        else:
            leafy_tree(p, X, S.y(top), root, ink, lean=0.04)
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
    # how far down each column's reflection may reach: the mirrored height of what stands above it,
    # shortened and ragged, so the reflection never ends on a mirrored crest (no lens edge)
    top = np.minimum(far, near)
    mh = np.clip((hz - top) * 0.72, S(4), None) * (0.55 + 0.3 * np.clip(0.5 + fbm1d(CW, S(160), 3, p.sd()), 0, 1))
    Yw, Xw = YY[hzi:CH], XX[hzi:CH]
    rel = (Yw - hz) / mh[None, :]
    # 1) a pale wash version of it, pulled across in horizontal bands that break into dashes and
    #    give out toward the end of the reflection
    band = vnz(rng, Yw, Xw, S(3.2), S(140), 2)
    brk = vnz(rng, Yw, Xw, S(2.6), S(34), 2) + 0.5 * vnz(rng, Yw, Xw, S(5), S(90), 2)
    thr = -1.4 + 3.2 * np.clip(rel, 0, 1.5) ** 1.2
    keep = sstep(thr - 0.25, thr + 0.25, brk)
    pale = refl * fade * 0.62 * np.clip(0.7 + 0.6 * band, 0, 1) * keep
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
        prof = smooth1d(refl[r], S(3)) * float(fade[r, 0]) * (rel[r] < rng.uniform(0.6, 1.0))
        on = prof > 0.24
        xs_on = np.flatnonzero(np.diff(on.astype(np.int8)) != 0)
        edges = np.concatenate([[0] if on[0] else [], xs_on + 1, [CW] if on[-1] else []]).astype(int)
        for a_, b_ in zip(edges[::2], edges[1::2]):
            if b_ - a_ < S(6):
                continue
            x0 = a_ + rng.uniform(0, 0.3) * (b_ - a_); x1 = b_ - rng.uniform(0, 0.3) * (b_ - a_)
            pieces = int(rng.integers(1, 4))
            xa = x0
            for q in range(pieces):
                xe = xa + (x1 - xa) * (rng.uniform(0.4, 1.0) if q < pieces - 1 else 1.0)
                if xe - xa > S(5):
                    ink = float(prof[int((xa + xe) / 2)]) * rng.uniform(0.35, 0.65)
                    yy = ry + rng.normal(0, S(0.8))
                    brush(p, [(xa, yy), ((xa + xe) / 2, yy + rng.normal(0, S(0.8))), (xe, yy + rng.normal(0, S(0.6)))],
                          S(rng.uniform(1.6, 4.2)), ink, dry=rng.uniform(0.4, 0.85), taper=(rng.uniform(0.05, 0.3), rng.uniform(0.2, 0.5)),
                          swell=rng.uniform(0.1, 0.6), maxseg=10)
                    n_str += 1
                xa = xe + S(rng.uniform(4, 22))
                if xa >= x1:
                    break
        ry += S(rng.uniform(4, 11)) * (1 + (ry - hzi) / S(120))
    p.snap('reflection strokes')
    # 3) the water itself: bare paper; a few long wind streaks dragged across with a nearly dry
    #    brush, each broken where the brush skipped
    for k in range(4):
        y = rng.uniform(860, 1060)
        xa = rng.uniform(-150, 1500); ln = rng.uniform(300, 900)
        u0 = 0.0
        while u0 < 1.0:
            u1 = min(1.0, u0 + rng.uniform(0.15, 0.5))
            pts = [S.pt(xa + ln * u, y + rng.normal(0, 1.5) + 4 * u) for u in np.linspace(u0, u1, 4)]
            brush(p, pts, S(rng.uniform(2.5, 6)), rng.uniform(0.12, 0.22), dry=rng.uniform(0.6, 0.85),
                  taper=(rng.uniform(0.05, 0.3), rng.uniform(0.2, 0.6)), swell=0.4, pv=0.3, pool=0.3, hair=1.2)
            u0 = u1 + rng.uniform(0.03, 0.15)
    p.snap('water body')
    ripples(p, S.y(HORIZON + 16), S.y(1070), S.x(S.X0), S.x(S.X1), clusters=9, ink=0.42,
            avoid=[(S.x(1040), S.y(760), S.x(1340), S.y(880)), (S.x(-200), S.y(900), S.x(330), S.y(1200))])
    p.snap('ripples 1')
    ripples(p, S.y(HORIZON + 10), S.y(800), S.x(600), S.x(1500), clusters=4, ink=0.3,
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
    # left as paper with a soft but ragged edge that has crept into the fibres — no airbrush ramp.
    # Thickest at the foot of the far range, thin on the left so the grove keeps its trunks.
    p.begin('mist', 'mist' in inc)
    rng = p.rng
    y0, y1 = int(max(0, S.y(560))), int(min(CH, S.y(740)))
    Ym, Xm = YY[y0:y1], XX[y0:y1]
    xd = XD[0]
    wob = fbm1d(CW, S(380), 3, p.sd())[None, :] * S(16)
    left = np.clip((620 - xd) / 220, 0, 1)
    yc = S.y(636) + S(30) * left
    reachx = 0.35 + 0.65 * np.clip(1 - left, 0, 1) * np.clip(1.2 - np.abs(xd - 1050) / 1100, 0.45, 1)
    half = (S(8) + S(30) * np.clip(0.5 + fbm1d(CW, S(260), 3, p.sd()), 0, 1) * reachx)[None, :]
    mz = vnz(rng, Ym, Xm, S(10), S(60), 4) * S(11) + vnz(rng, Ym, Xm, S(3), S(7), 2) * S(2.2)
    m = np.clip((half - np.abs(Ym - yc[None, :] - wob) + mz + fibre_bleed(p, y0, y1, 0, CW, S(7))) / S(4), 0, 1)
    m = m * np.clip(0.85 + 0.15 * vnz(rng, Ym, Xm, S(30), S(160), 2), 0, 1)
    m[m < 0.003] = 0
    occ = np.zeros_like(p.D); occ[y0:y1] = 0.88 * m
    p.occlude(occ, 0.6 * occ)
    p.snap('mist', dense=False)
    p.end()

    # ================================================================ boat, fisherman, its reflection
    p.begin('boat', 'boat' in inc)
    BX, BY = S.x(1170), S.y(800)
    # hull: one loaded stroke pressed hard in the middle and lifted at bow and stern
    brush(p, S.pts([(1080, 784), (1118, 803), (1200, 806), (1264, 781)]), S(10), 0.86, dry=0.25, taper=(0.12, 0.2),
          swell=0.55, pv=0.15, side=0.5, pool=0.35)
    brush(p, S.pts([(1090, 788), (1150, 794), (1214, 793), (1252, 784)]), S(3), 0.55, dry=0.5, taper=(0.2, 0.5), swell=0.6)
    p.snap('hull')
    FX, FY = S.x(1150), S.y(790)
    P = lambda x, y: (FX + S(x), FY + S(y))
    # the fisherman in a straw cape: one broad stroke, widest at the hem, pressed and lifted
    brush(p, [P(-9, 2), P(-6, -10), P(-1, -20), P(2, -26)], S(14), 0.84, dry=0.3, taper=(0.05, 0.4), swell=0.3,
          grow=(1.0, 0.6), side=-0.4, pool=0.4)
    p.wet_dot(*P(2.5, -27.5), S(3.6), 0.85, squash=1.15, irr=0.6)
    # conical hat sitting on his head: a pale wash of the cone, then two strokes from the apex
    # that swell out to the brim, and a pressed brim stroke
    fill_poly(p, [P(1, -45), P(-15, -31.5), P(-4, -29.8), P(10, -29.6), P(20, -31.2)], 0.42, rough=0.35, soft=S(0.8))
    brush(p, [P(1.5, -45), P(-6, -38), P(-15, -31.5)], S(3.2), 0.86, dry=0.25, taper=(0.4, 0.1), swell=0.3)
    brush(p, [P(1.5, -45), P(10, -38.5), P(20.5, -31.5)], S(3.6), 0.86, dry=0.25, taper=(0.4, 0.1), swell=0.3)
    brush(p, [P(-16, -31), P(-2, -29.4), P(10, -29.6), P(21, -31.4)], S(3.6), 0.9, dry=0.2, taper=(0.15, 0.2), swell=0.6)
    # the pole: a long line that swells where the hand presses and thins to the water
    brush(p, [P(3, -18), P(30, -6), P(56, 9), P(82, 27)], S(2.6), 0.75, dry=0.35, taper=(0.05, 0.6), swell=0.5, pv=0.25)
    p.snap('rower')
    # the boat's reflection: three broken pulls of differing length and a short dark touch under the figure
    for k, (xa, xb, yy) in enumerate(((1094, 1236, 812), (1112, 1214, 823), (1136, 1190, 835))):
        xa += rng.uniform(-8, 8); xb += rng.uniform(-10, 10)
        cut = rng.uniform(0.35, 0.65)
        for (u0, u1) in ((0.0, cut - rng.uniform(0.02, 0.1)), (cut + rng.uniform(0.0, 0.06), 1.0)):
            if rng.random() < 0.15 * k:
                continue
            xs_ = [xa + (xb - xa) * u for u in np.linspace(u0, u1, 3)]
            brush(p, [S.pt(x_, yy + rng.normal(0, 1.2)) for x_ in xs_], S(3.6 - 0.8 * k), 0.34 - 0.08 * k,
                  dry=rng.uniform(0.45, 0.8), taper=(0.25, 0.35), swell=rng.uniform(0.2, 0.7))
    brush(p, S.pts([(1147, 829), (1150, 848), (1153, 866)]), S(5), 0.2, dry=0.65, taper=(0.15, 0.5), swell=0.4)
    for k in range(2):
        xa = 1010 + rng.uniform(-20, 40) + 160 * k; xb = xa + rng.uniform(60, 130)
        brush(p, [S.pt(x_, 828 + 6 * k + rng.normal(0, 1)) for x_ in np.linspace(xa, xb, 3)], S(1.6), 0.18, dry=0.6,
              taper=(0.3, 0.4), swell=0.5)
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
