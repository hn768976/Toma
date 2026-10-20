"""Mountain lake at dusk -- X-ray (X 光片).
The lake scene as if it were a diorama put through a dual-energy scanner: every element is built as material along
the beam (Beer-Lambert), seen in the radiograph film display. No OSD, panels, side bars or text."""
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))

import numpy as np
import drawkit
from drawkit import Scaler, seed_all, save_png
from xray import XRay

STYLE = "X-ray · X 光片"
LIB = "xray"

HZ = 640


def paint(W=1920, H=1080, seed=1, stages_dir=None):
    seed_all(seed)
    S = Scaler(W, H)
    s = S.s
    x = XRay(W, H, px_cm=17 * s, seed=seed)       # px_cm scales with the canvas, so attenuations stay the same
    x.scan(scatter_px=55 * s, focal=0.6 * s, module=max(8, int(round(64 * s))))
    x.film(amax=7.0, glow=0.55)
    rng = np.random.default_rng(seed + 11)
    P = lambda pts: np.asarray(S.pts(pts), np.float32)
    P3 = lambda pts: np.asarray([(a * s, b * s, c * s) for a, b, c in pts], np.float32)

    def grad(y0, y1, a, b, power=1.0):
        """slab texture: thickness multiplier fading from a (at design y0) to b (at y1)"""
        def tex(x0, yy0, shape):
            ys = (np.arange(yy0, yy0 + shape[0], dtype=np.float32) + 0.5) / s
            t = np.clip((ys - y0) / (y1 - y0), 0, 1) ** power
            return np.repeat((a + (b - a) * t)[:, None], shape[1], 1).astype(np.float32)
        return tex

    def trod(pts, mat, r0, r1, **kw):
        """tapered rod along a smooth path through design points"""
        Q = np.asarray(pts, np.float32)
        if len(Q) == 2:
            Q = np.stack([Q[0] + (Q[1] - Q[0]) * t for t in np.linspace(0, 1, 8)])
        Q = x.path(P(Q))
        x.rod(Q, mat, np.linspace(S(r0), S(r1), len(Q)), **kw)

    # ---- 1. the sky: a thin plastic sheet thickening toward the horizon, and the low sun as a glass sphere
    x.slab(P([(-10, -10), (1930, -10), (1930, HZ), (-10, HZ)]), 'organic', S(46), edge=0,
           texture=grad(0, HZ, 0.04, 1.0, 1.8))
    x.disc(S(1240), S(560), S(170), 'organic', S(6), dome=S(50), density=0.45)
    x.stage('sky')

    # ---- 2. far range: a hollow shell -- its outline glows where the beam runs along the wall, inside is faint
    far = [(-30, 420), (110, 362), (240, 405), (400, 335), (530, 390), (670, 350), (810, 400), (960, 326),
           (1090, 384), (1250, 296), (1410, 372), (1540, 342), (1670, 392), (1800, 350), (1950, 400),
           (1950, 1300), (-30, 1300)]
    x.shell(P(far), 'organic', S(260), S(7), edge=S(40), density=1.0)
    x.stage('far_mountains')

    # ---- 3. near range: solid plaster cast with rounded edges, denser and brighter, with strata as tubes
    near = [(-30, 470), (140, 436), (300, 456), (470, 428), (640, 466), (800, 452), (950, 516), (1080, 556),
            (1230, 543), (1380, 584), (1560, 560), (1720, 598), (1950, 588), (1950, HZ), (-30, HZ)]
    x.slab(P(near), 'plaster', S(40), edge=S(20), density=0.65)
    for st in ([(330, 520), (470, 450), (600, 540)], [(60, 540), (140, 452), (240, 560)],
               [(700, 560), (800, 470), (900, 590)], [(1160, 610), (1230, 560), (1300, 620)]):
        x.rod(x.path(P(st)), 'plaster', S(2.2), density=0.9)
    x.stage('near_mountains')

    # ---- 4. the lake: water thickening toward the viewer, the ranges mirrored as faint shells,
    #         ripples as thin glass strips
    x.slab(P([(-10, HZ), (1930, HZ), (1930, 1090), (-10, 1090)]), 'water', S(30), edge=0,
           texture=grad(HZ, 1080, 0.15, 1.0, 0.9))
    mirror = lambda pts: [(a, 2 * HZ - b) for a, b in pts]
    x.slab(P(mirror(far[:-2]) + [(1950, HZ), (-30, HZ)]), 'organic', S(40), edge=S(20), density=0.35)
    x.slab(P(mirror(near)), 'plaster', S(40), edge=S(20), density=0.4)
    for i in range(26):
        y = HZ + 30 + (i / 25) ** 1.4 * 420 + rng.uniform(-6, 6)
        ln = 40 + (y - HZ) * 0.5 * rng.uniform(0.5, 1.2)
        x0 = rng.uniform(-60, 1900)
        if 1040 < x0 + ln / 2 < 1300 and 770 < y < 840:
            continue
        x.rod(x.path(P([(x0, y), (x0 + ln / 2, y - 1.5), (x0 + ln, y)])), 'glass', S(1.2 + (y - HZ) / 300),
              flat=S(4), density=0.6)
    x.stage('water')

    # ---- 5. pines: tapered wooden trunk, whorls of drooping branch rods, the needle mass as knit-textured fibre
    def pine(px, root, h, w, dens=1.0, refl=False):
        sg = -1 if refl else 1
        Y = lambda y: root + sg * (y - root) if not refl else 2 * HZ - y
        top = root - h
        trod([(px, Y(root)), (px, Y(top + h * 0.02))], 'organic', w * 0.07, 1.2, density=2.6 * dens)
        n = max(4, int(h / 22))
        for i in range(n):
            u = (i + 1) / (n + 1)
            yb = top + h * (0.08 + 0.80 * u)
            L = w / 2 * (0.25 + 0.75 * u)
            for sd in (-1, 1):
                pts = [(px, yb), (px + sd * L * 0.55, yb + L * 0.12), (px + sd * L, yb + L * 0.32)]
                trod([(a, Y(b)) for a, b in pts], 'organic', 2.0, 0.7, density=2.4 * dens)
        tri = [(px, top), (px + w / 2, root - h * 0.1), (px - w / 2, root - h * 0.1)]
        x.slab(P([(a, Y(b)) for a, b in tri]), 'organic', S(36), edge=S(14), density=0.9 * dens,
               texture=x.weave('knit', S(4.0), 0, 0.35, seed=int(rng.integers(1 << 30))))

    pines = [(80, 470, 70), (150, 430, 82), (230, 452, 76), (300, 418, 90), (370, 470, 76), (440, 505, 62),
             (500, 540, 50), (40, 525, 56), (270, 522, 60), (190, 536, 54),
             (1520, 575, 36), (1580, 558, 42), (1650, 585, 32), (1740, 568, 38), (1790, 592, 28)]
    for px, top, w in pines:
        pine(px, HZ + 8, HZ + 8 - top, w)
    for px, top, w in pines:
        pine(px, HZ + 8, HZ + 8 - top, w, dens=0.3, refl=True)
    x.stage('trees')

    # ---- 6. the boat: hull as a wooden shell, ribs, steel nails seen end-on, oarlocks, oars, and the rower --
    #         who, this being an X-ray, is a skeleton in a coat
    hull = [(1080, 783), (1110, 803), (1236, 803), (1260, 783), (1250, 778), (1090, 778)]
    x.shell(x.closed(P(hull), 8), 'organic', S(70), S(3), edge=S(10), density=2.6)
    for u in np.linspace(1104, 1236, 7):
        x.rod(x.path(P([(u, 779), (u + (1170 - u) * 0.06, 801)])), 'organic', S(1.6), density=1.4)
    for u in np.linspace(1096, 1244, 12):
        x.disc(S(u), S(781), S(1.4), 'steel', S(5))
    x.rod(x.path(P([(1092, 790), (1170, 799), (1248, 790)])), 'organic', S(1.4), density=1.2)   # keel line
    # skeleton: skull, jaw, spine, ribcage, pelvis, arms, femurs (seated)
    x.shell(x.ellipse(S(1160), S(732), S(8.5), S(9.5)), 'bone', S(16), S(1.6), edge=S(5))
    x.slab(x.ellipse(S(1166), S(741), S(5), S(2.4), 15), 'bone', S(5), edge=S(2))
    x.rod(x.path(P3([(1158, 744, 0), (1156, 756, 3), (1157, 770, 0), (1159, 778, 0)])), 'bone', S(1.5),
          ribs=(0.45, S(2.5)))
    for j in range(5):
        yy = 750 + j * 4
        x.rod(x.path(P3([(1157, yy, 0), (1166 - j * 0.4, yy + 1.5, 3), (1168 - j * 0.6, yy + 4, 0)])), 'bone', S(0.8))
        x.rod(x.path(P3([(1157, yy, 0), (1149 + j * 0.4, yy + 1.5, 3), (1148 + j * 0.5, yy + 4, 0)])), 'bone', S(0.8),
              density=0.5)
    x.slab(x.ellipse(S(1160), S(778), S(7), S(3)), 'bone', S(6), edge=S(2))
    x.rod(x.path(P([(1158, 777), (1176, 780)])), 'bone', S(1.7))                             # femur, seated
    x.rod(x.path(P([(1176, 780), (1180, 792)])), 'bone', S(1.4))                             # shin
    x.rod(x.path(P([(1160, 750), (1172, 760), (1186, 758)])), 'bone', S(1.2))                # arm to the oar
    x.fabric(x.closed(P([(1146, 748), (1168, 746), (1172, 778), (1146, 780)]), 6), S(16), layers=4,
             sheet=S(1.5), density=0.6, scale=S(3.5))                                       # the coat
    # oar with its steel oarlock
    x.rod(x.path(P([(1188, 756), (1214, 790), (1236, 818)])), 'organic', S(2.0), density=1.5)
    x.slab(x.ellipse(S(1242), S(826), S(11), S(4), 52), 'organic', S(5), edge=S(2), density=1.4)
    x.coil((S(1212), S(783)), (S(1216), S(790)), S(3.5), 3, 'steel', S(0.8))
    # the boat's reflection, faint
    x.shell(x.closed(P([(a, 1606 - b) for a, b in hull]), 8), 'organic', S(70), S(3), edge=S(10), density=0.35)
    x.stage('boat')

    # ---- 7. birds: tiny gull skeletons, wings spread (hollow bird bones: tubes)
    for bx, by, sz in [(1380, 260, 26), (1450, 225, 20), (1530, 285, 22), (1600, 200, 17), (1665, 250, 15)]:
        for sd in (-1, 1):
            x.tube(x.path(P([(bx, by), (bx + sd * sz * 0.45, by - sz * 0.42), (bx + sd * sz, by - sz * 0.2)])),
                   'bone', S(2.0 + sz / 20), S(0.7), density=2.0)
            for f in range(3):
                fx = bx + sd * sz * (0.55 + 0.17 * f)
                x.rod(x.path(P([(fx, by - sz * 0.35 + f * 1.5), (fx + sd * sz * 0.16, by - sz * 0.1)])), 'organic',
                      S(0.9), density=1.2)
        x.slab(x.ellipse(S(bx), S(by + 2), S(sz * 0.2), S(sz * 0.1)), 'bone', S(5), edge=S(2))
    x.stage('birds')

    # ---- 8. mist: a band of low-density fibre over the water, thicker at the left
    def mist_tex(x0, y0, shape):
        h, w = shape
        ys = ((np.arange(y0, y0 + h, dtype=np.float32) + 0.5) / s)[:, None]
        xs = ((np.arange(x0, x0 + w, dtype=np.float32) + 0.5) / s)[None, :]
        band = np.exp(-((ys - 650) / 38.0) ** 2) * (1.0 - 0.7 * np.clip((xs - 150) / 1550, 0, 1))
        n = drawkit_noise(h, w, int(rng.integers(1 << 30)))
        return (band * (0.6 + 0.8 * n)).astype(np.float32)

    def drawkit_noise(h, w, sd):
        from core import noise2d
        return noise2d(h, w, 160 * s, 3, sd)

    x.slab(P([(-10, 570), (1930, 570), (1930, 740), (-10, 740)]), 'organic', S(60), edge=0, texture=mist_tex,
           density=0.5)
    x.stage('mist')

    # ---- 9. reeds: tapered hollow stems in the lower-left corner
    for i in range(18):
        bx = rng.uniform(0, 300)
        top = rng.uniform(930, 990) - (300 - bx) * 0.2
        lean = rng.uniform(-24, 30)
        trod([(bx, 1090), (bx + lean * 0.35, (1090 + top) / 2), (bx + lean, top)], 'organic', 4.0, 0.8,
             wall=S(1.0), density=1.4)
    x.stage('reeds')

    img = x.composite()
    if stages_dir:
        os.makedirs(stages_dir, exist_ok=True)
        for i, (name, lo, hi, n, tp) in enumerate(x.stages):
            x.composite(lo.astype(np.float32), hi.astype(np.float32), n, tp).save(
                os.path.join(stages_dir, f'{i:02d}_{name}.png'))
    return img


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else 'xray_lake.png'
    W, H = (int(sys.argv[2]), int(sys.argv[3])) if len(sys.argv) > 3 else (1920, 1080)
    save_png(paint(W, H), out)
