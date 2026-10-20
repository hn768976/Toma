"""Mountain lake at dusk -- Art Deco (airbrush through cut friskets, 1930s travel-poster look).
No lettering, no border: full-bleed scene."""
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))

import numpy as np
import drawkit
from drawkit import Scaler, seed_all, save_png
from artdeco import ArtDeco
from core import smoothstep

STYLE = "Art Deco · 装饰艺术"
LIB = "artdeco"

HZ = 640          # waterline (design px)
SUN = (1240, 560)


def _ridge_faces(a, S, ridge, base, body, shade, light_x, density=0.55):
    """one mountain range: the whole silhouette as one frisket sprayed with a vertical fade, then each peak's
    shadow face (the side turned away from the sun) sprayed darker through its own cut frisket."""
    pts = S.pts(ridge) + [S.pt(ridge[-1][0], base), S.pt(ridge[0][0], base)]
    m = a.poly(pts)
    top = min(y for _, y in ridge)
    a.fade(m, body, S.pt(0, top), S.pt(0, base))
    # peaks are local minima in y
    for i in range(1, len(ridge) - 1):
        (x0, y0), (x1, y1), (x2, y2) = ridge[i - 1], ridge[i], ridge[i + 1]
        if not (y1 < y0 and y1 < y2):
            continue
        if x1 < light_x:      # sun to the right: the left flank is in shadow
            xs = x1 - (x1 - x0) * 0.75
            face = [(x1, y1), (x0, y0), (xs, base), (x1 + (x1 - x0) * 0.1, base)]
        else:
            xs = x1 + (x2 - x1) * 0.75
            face = [(x1, y1), (x2, y2), (xs, base), (x1 - (x2 - x1) * 0.1, base)]
        fm = a.poly(S.pts(face)) * m
        a.fade(fm, shade, S.pt(0, y1), S.pt(0, base))
        # a hairline of sunlit rim along the lit ridge (the frisket edge catching the glow)


def _pine(a, S, x, root, h, w, body, light_x, tiers=4):
    """a Deco conifer: a stack of cut triangular tiers on a thin trunk, each tier sprayed dark->lit across"""
    tw = max(1.0, w * 0.08)
    a.spray(a.rect(S(x - tw / 2), S(root - h * 0.18), S(x + tw / 2), S(root)), '#1a1626', grain=0.4)
    top = root - h
    for k in range(tiers):
        f = k / tiers
        ty = top + h * 0.78 * f * 0.92
        by = top + h * (0.30 + 0.62 * (k + 1) / tiers)
        hw = w / 2 * (0.42 + 0.58 * (k + 1) / tiers)
        m = a.poly(S.pts([(x, ty), (x + hw, by), (x + hw * 0.55, by - h * 0.035), (x, by + h * 0.01),
                          (x - hw * 0.55, by - h * 0.035), (x - hw, by)]))
        lit = 1 if x < light_x else -1
        a.fade(m, body, S.pt(x - hw * lit, by), S.pt(x + hw * lit, ty))


def paint(W=1920, H=1080, seed=1, stages_dir=None):
    seed_all(seed)
    S = Scaler(W, H)
    a = ArtDeco(W, H, seed=seed)
    hz = S(HZ)

    # ---- 1. sky: one long fade, dusk violet down to peach at the range
    a.sky([(0, '#1b1840'), (0.22, '#3a2a5c'), (0.42, '#8a4a6e'), (0.56, '#e0866e'), (0.70, '#f6c08c'),
           (1, '#fbd6a4')],
          bottom=hz)
    a.stage('sky')

    # ---- 2. sunburst behind the far range, and the low sun
    a.burst(S(SUN[0]), S(SUN[1]), rays=36, contrast=0.12, reach=S(1150), colour='#ffd9a0', dark='#5a2c55',
            glow=0.6, phase=5.0, bottom=hz)
    a.moon(S(SUN[0]), S(SUN[1] - 10), S(78), stops=((0, '#fff4d6'), (0.55, '#ffd08a'), (1, '#f08a5a')),
           halo='#ffcf96', halo_r=3.0, halo_strength=0.6)
    a.stage('sun')

    # ---- 3. far range: pale, hazy, low contrast
    far = [(-20, 430), (110, 372), (230, 410), (390, 338), (520, 395), (660, 352), (800, 405), (950, 330),
           (1080, 392), (1250, 296), (1400, 380), (1530, 345), (1660, 400), (1790, 352), (1940, 410)]
    _ridge_faces(a, S, far, HZ, [(0, '#c28aa0'), (1, '#e7a99a')], [(0, '#9a6f97'), (1, '#c48e9c')],
                 SUN[0])
    a.stage('far_mountains')

    # ---- 4. near range: darker, left-heavy shoulder, dipping right
    near = [(-20, 470), (140, 438), (300, 458), (470, 430), (640, 470), (800, 452), (950, 520), (1080, 560),
            (1230, 545), (1380, 585), (1560, 560), (1720, 600), (1940, 590)]
    _ridge_faces(a, S, near, HZ, [(0, '#4a3866'), (1, '#6e4a6e')], [(0, '#2a2148'), (1, '#3d2a52')],
                 SUN[0])
    a.stage('near_mountains')

    # ---- 5. pines on the shores (roots on the waterline so the river mirrors them)
    pines_l = [(80, 470, 70), (150, 430, 82), (230, 450, 76), (300, 420, 88), (370, 470, 74), (440, 505, 62),
               (500, 540, 50), (40, 520, 56), (270, 520, 60), (190, 535, 54)]
    body = [(0, '#120f22'), (0.6, '#21304a'), (1, '#3c5a5e')]
    for x, top, w in pines_l:
        _pine(a, S, x, HZ, HZ - top, w, body, SUN[0])
    for x, top, w in [(1520, 575, 34), (1580, 560, 40), (1650, 585, 30), (1740, 570, 36), (1790, 590, 26)]:
        _pine(a, S, x, HZ, HZ - top, w, body, SUN[0], tiers=3)
    a.stage('trees')

    # ---- 6. the lake mirrors everything above it in ripple dashes
    a.water(hz, stops=((0, '#a8687a'), (0.3, '#4a3462'), (1, '#120e26')), reflect=0.75)
    # the shore bank under the left pines
    a.spray(a.poly(S.pts([(-10, 636), (560, 636), (600, 644), (520, 652), (-10, 654)])), '#14111f', grain=0.3)
    a.spray(a.poly(S.pts([(1490, 638), (1830, 638), (1860, 645), (1480, 646)])), '#1a1528', grain=0.3)
    a.stage('water')

    # ---- 7. the boat: hull frisket sprayed dark->lit, rower, oar, and its reflection
    bw = 800
    hull = [(1080, 784), (1260, 784), (1240, 803), (1104, 803)]
    refl = [(x, 2 * bw - y) for x, y in hull]
    a.spray(a.poly(S.pts(refl)) * 0.55, '#1a1430', grain=0.6)
    hm = a.poly(S.pts(hull))
    a.fade(hm, [(0, '#2a1a24'), (0.6, '#6a3a34'), (1, '#c97a52')], S.pt(1100, 803), S.pt(1240, 784))
    a.spray(a.rect(S(1080), S(782), S(1260), S(785.5)), '#f2b77a', grain=0.4)       # gunwale catching the sun
    # rower: torso, head, oar
    fig = a.poly(S.pts([(1150, 784), (1176, 784), (1172, 752), (1154, 752)]))
    a.fade(fig, [(0, '#1c1428'), (1, '#5b3a4a')], S.pt(1150, 770), S.pt(1176, 760))
    a.spray(a.disc(S(1163), S(744), S(9)), '#2a1d30', grain=0.4)
    a.spray(a._bar(S.pt(1120, 812), S.pt(1200, 764), S(3)), '#2a1d30', grain=0.3)
    # rower reflection, broken
    rm = a.poly(S.pts([(1150, 816), (1176, 816), (1172, 848), (1154, 848)]))
    a.spray(rm * 0.35, '#1a1430', grain=0.6)
    a.stage('boat')

    # ---- 8. mist: soft horizontal bands of airbrushed haze over the water, thicker at the left
    yy, xx = a.yy / S.s, a.xx / S.s
    band = np.exp(-((yy - 648) / 34.0) ** 2) * (0.62 - 0.4 * smoothstep(200, 1700, xx))
    band += np.exp(-((yy - 690) / 16.0) ** 2) * 0.28 * (1 - smoothstep(300, 1300, xx))
    a.spray(band.astype(np.float32), '#f1c7b6', grain=0.8, blend='paint')
    a.stage('mist')

    # ---- 9. birds: little cut gull silhouettes
    for bx, by, sz in [(1380, 260, 26), (1450, 225, 20), (1530, 285, 22), (1600, 200, 17), (1665, 250, 15)]:
        a.spray(a.poly(S.pts([(bx - sz, by - sz * 0.25), (bx - sz * 0.45, by - sz * 0.42), (bx, by),
                              (bx + sz * 0.45, by - sz * 0.42), (bx + sz, by - sz * 0.25),
                              (bx + sz * 0.45, by - sz * 0.22), (bx, by + sz * 0.16),
                              (bx - sz * 0.45, by - sz * 0.22)])), '#2a1d3e', grain=0.3)
    a.stage('birds')

    # ---- 10. reeds in the lower-left corner
    rr = np.random.default_rng(seed + 7)
    for k in range(22):
        x = rr.uniform(0, 300)
        top = rr.uniform(930, 990) - (300 - x) * 0.25
        lean = rr.uniform(-18, 26)
        w = rr.uniform(5.0, 9.0)
        m = a.poly(S.pts([(x - w, 1085), (x + w, 1085), (x + lean, top)]))
        a.fade(m, [(0, '#0c0a16'), (0.7, '#3a2a40'), (1, '#c07a6a')], S.pt(x, 1085), S.pt(x + lean, top))
    a.stage('reeds')

    a.finish(vignette=0.14)
    img = a.composite()
    if stages_dir:
        os.makedirs(stages_dir, exist_ok=True)
        for i, (name, im) in enumerate(a.stages):
            im.save(os.path.join(stages_dir, f'{i:02d}_{name}.png'))
    return img


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else 'artdeco_lake.png'
    W, H = (int(sys.argv[2]), int(sys.argv[3])) if len(sys.argv) > 3 else (1920, 1080)
    save_png(paint(W, H), out)
