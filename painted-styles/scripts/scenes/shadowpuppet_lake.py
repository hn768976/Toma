"""Mountain lake at dusk -- Shadow puppetry (皮影戏).
The lamp-lit amber screen fills the frame and is the sky; every scene element is a cut, dyed, hollow-carved
translucent leather scenery piece pressed to the cloth. No stage frame, plaque or lanterns."""
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))

import numpy as np
import drawkit
from drawkit import Scaler, seed_all, save_png
from shadowpuppet import ShadowPuppet, Puppet
from core import spline, smoothstep

STYLE = "Shadow puppetry · 皮影戏"
LIB = "shadowpuppet"

HZ = 640


def _mist(X, Y):
    """design-space mist density 0..1: a soft band over the waterline, thicker at the left"""
    return (np.exp(-((Y - 650) / 52.0) ** 2) * (1.0 - 0.7 * smoothstep(150, 1700, X))).astype(np.float32)


def _mirror(sp, src, name, alpha=0.45, d=0.08, axis=HZ):
    """a second rendering of a scenery piece flipped about the waterline (rot 180 + horizontal flip = vertical
    mirror), held a little off the cloth so it goes soft: the piece's reflection in the lake"""
    m = sp.puppet(name, src.k)
    for n in src.order:
        m.parts[n] = dict(src.parts[n]); m.order.append(n); m.angles[n] = src.angles[n]
    sp.place(m, src.x, 2 * axis * src.k - src.y, rot=180, flip=True, alpha=alpha, d=d)
    return m


def _range(sp, k, ridge, dye, base_dye, pattern, psize, strata, seed, mist=0.0):
    pts = np.asarray(ridge, np.float32)                  # knife-cut straight flanks, sharp peaks
    poly = np.vstack([pts, [(ridge[-1][0], HZ + 4), (ridge[0][0], HZ + 4)]])
    L = sp.leather(-30, min(y for _, y in ridge) - 10, 1950, HZ + 10, k, ss=2, seed=seed)
    m = L.fill(poly, dye)
    X, Y = L.grid()
    lo = np.clip((Y - (HZ - 120)) / 120.0, 0, 1).astype(np.float32)
    L.dye(m * lo * 0.6, base_dye)                         # the foot of the range dyed deeper
    # hollow-carved rock pattern in a band under the ridge, ridge strata cut as thin slits
    top = np.interp(X, pts[:, 0], pts[:, 1]).astype(np.float32)
    band = ((Y > top + 22) & (Y < top + 22 + psize * 2.2)).astype(np.float32) * m
    L.pattern(band, pattern, psize, margin=5, origin=(0, 0), seed=seed)
    for s in strata:
        L.carve(spline(s, 6), 2.2)
    if mist:
        L.dye(m * _mist(X, Y) * mist, 'plain')            # the hide is thinner / paler where the mist lies
    L.edge(2.6)
    return sp.prop(L, 'range')


def _pine(sp, k, x, root, h, w, seed, dye='green'):
    L = sp.leather(x - w / 2 - 4, root - h - 6, x + w / 2 + 4, root + 4, k, ss=3, seed=seed)
    tr = L.fill([(x - w * 0.05, root - h * 0.25), (x + w * 0.05, root - h * 0.25), (x + w * 0.07, root),
                 (x - w * 0.07, root)], 'brown')
    tiers = 4 if h > 120 else 3
    tops = []
    for i in range(tiers):
        ty = root - h + h * 0.72 * i / tiers
        by = root - h * 0.18 - h * 0.62 * (tiers - 1 - i) / tiers
        hw = w / 2 * (0.45 + 0.55 * (i + 1) / tiers)
        tm = L.fill(_scallop(x, ty, by, hw), dye)
        tops.append(tm)
    allm = np.clip(sum(tops), 0, 1)
    if w > 50:
        L.pattern(allm, 'scales', 15, margin=4, origin=(x, root - h))
    else:
        L.pattern(allm, 'dots', 12, r=0.25, margin=3.5, origin=(x, root - h))
    for tm in tops:
        L.contour(tm, 1.6)
    L.edge(2.0)
    return sp.prop(L, 'pine')


def _scallop(x, ty, by, hw, n=4):
    """a pine tier: a triangle whose lower edge is cut in scallops (the hide-carver's bough)"""
    lower = [(x + hw - 2 * hw * j / n, by - (by - ty) * (0.12 if j % 2 else 0.0)) for j in range(1, n)]
    return [(x, ty), (x + hw, by)] + lower + [(x - hw, by)]


def paint(W=1920, H=1080, seed=1, stages_dir=None):
    seed_all(seed)
    S = Scaler(W, H)
    k = S.s
    sp = ShadowPuppet(W, H, seed=seed, keep_stages=True)
    rng = np.random.default_rng(seed + 3)
    sd = lambda: int(rng.integers(1 << 30))

    # ---- 1. the lit screen is the dusk sky: the lamp behind the low sun
    sp.screen(hot=(S(1220), S(540)), folds=1)
    sp.stage('screen')

    # ---- 2. far range: pale pink hide, a little off the cloth so it is hazy
    far = [(-30, 420), (110, 362), (240, 405), (400, 335), (530, 390), (670, 350), (810, 400), (960, 326),
           (1090, 384), (1250, 296), (1410, 372), (1540, 342), (1670, 392), (1800, 350), (1950, 400)]
    strata_f = [[(330, 420), (400, 372), (470, 430)], [(1170, 380), (1250, 330), (1330, 400), (1380, 440)],
                [(880, 420), (960, 360), (1020, 410)], [(1600, 420), (1670, 392)]]
    far_p = _range(sp, k, far, (0.95, 0.62, 0.62), (0.80, 0.50, 0.58), 'dots', 22, strata_f, sd(), mist=0.0)
    sp.place(far_p, 0, 0, d=0.03, alpha=0.75)
    sp.stage('far_mountains')

    # ---- 3. near range: teal-dyed hide, ice-crack rock carving, left-heavy shoulder
    near = [(-30, 470), (140, 436), (300, 456), (470, 428), (640, 466), (800, 452), (950, 516), (1080, 556),
            (1230, 543), (1380, 584), (1560, 560), (1720, 598), (1950, 588)]
    strata_n = [[(380, 500), (470, 446), (560, 520)], [(120, 520), (140, 456), (220, 540)],
                [(720, 520), (800, 470), (880, 540)], [(1170, 590), (1230, 560), (1290, 600)]]
    near_p = _range(sp, k, near, (0.16, 0.46, 0.62), (0.08, 0.22, 0.42), 'cloud', 30, strata_n, sd(), mist=1.0)
    sp.place(near_p, 0, 0, d=0.0)
    sp.stage('near_mountains')

    # ---- 4. the lake: one big piece dyed teal -> deep blue toward the viewer, ripples cut through as slits
    L = sp.leather(-30, HZ - 4, 1950, 1090, k, ss=2, seed=sd())
    wm = L.fill([(-30, HZ - 2), (1950, HZ - 2), (1950, 1090), (-30, 1090)], (0.36, 0.72, 0.80))
    X, Y = L.grid()
    L.dye(wm * np.clip((Y - HZ) / 420.0, 0, 1) ** 0.8, (0.06, 0.30, 0.44))
    L.dye(wm * np.clip(_mist(X, Y) * 1.2, 0, 1), 'plain')
    for i in range(22):                                     # ripple slits: short near the shore, long nearby
        y = HZ + 40 + (i / 21) ** 1.5 * 400 + rng.uniform(-6, 6)
        ln = 30 + (y - HZ) * 0.2 * rng.uniform(0.5, 1.2)
        x = rng.uniform(-40, 1920)
        if 1060 < x < 1280 and 770 < y < 830: continue      # leave the boat's water calm
        L.carve([(x, y), (x + ln * 0.5, y - 1.2), (x + ln, y)], 1.6 + (y - HZ) / 260, rim=0.6)
    L.edge(2.0)
    water = sp.prop(L, 'water')
    sp.place(water, 0, 0)
    # reflections: the ranges mirrored, soft
    _mirror(sp, far_p, 'far_refl', alpha=0.30, d=0.10)
    _mirror(sp, near_p, 'near_refl', alpha=0.45, d=0.08)
    sp.stage('water')

    # ---- 5. pines: left cluster and a few on the right shore, each with its reflection
    pines = [(80, 470, 74), (150, 430, 84), (230, 452, 76), (300, 418, 90), (370, 470, 76), (440, 505, 62),
             (500, 540, 50), (40, 525, 56), (270, 522, 60), (190, 536, 54),
             (1520, 575, 36), (1580, 558, 42), (1650, 585, 32), (1740, 568, 38), (1790, 592, 28)]
    trees = []
    for x, top, w in pines:
        p = _pine(sp, k, x, HZ + 6, HZ + 6 - top, w, sd(), dye='green' if x < 1000 else (0.30, 0.62, 0.30))
        sp.place(p, 0, 0)
        trees.append(p)
    for i, p in enumerate(trees):
        _mirror(sp, p, f'pine_refl{i}', alpha=0.38, d=0.08)
    # shore bank under the left cluster
    L = sp.leather(-30, HZ - 12, 620, HZ + 20, k, ss=3, seed=sd())
    L.fill(spline([(-30, HZ + 14), (-30, HZ - 6), (200, HZ - 10), (420, HZ - 6), (590, HZ + 2), (520, HZ + 12)], 6),
           'brown')
    L.edge(1.8)
    sp.place(sp.prop(L, 'bank'), 0, 0)
    sp.stage('trees')

    # ---- 6. the boat: a carved hull with a row of coin holes, a rower in a conical hat, the oar on its own joint
    boat = sp.puppet('boat', k)
    L = sp.leather(-100, -24, 100, 14, k, ss=3, seed=sd())
    hull = L.fill(spline([(-98, -20), (-80, -6), (-60, 6), (60, 6), (82, -6), (98, -20), (60, -14), (-60, -14)], 6),
                  'brown')
    L.dye(hull * L.above(-11), 'ochre')
    L.pattern(hull * L.below(-10), 'coins', 13, r=0.34, square=0.1, margin=2.6, origin=(0, -2))
    L.edge(2.0)
    boat.add('hull', L)
    L = sp.leather(-24, -88, 24, 4, k, ss=3, seed=sd())
    body = L.fill(spline([(-15, 0), (-14, -32), (-6, -50), (8, -50), (14, -34), (16, 0)], 6), 'teal')
    L.pattern(body * L.below(-44) * L.above(-6), 'dots', 10, r=0.26, margin=3)
    face = L.fill(L.ellipse(4, -60, 9, 10), 'plain')
    L.punch(L.ellipse(5, -60, 6.5, 7.5), rim=0.9)            # 阳刻 hollow face
    L.line([(9, -62), (13, -60), (9, -56)], 1.2)
    hat = L.fill([(-22, -66), (24, -66), (2, -86)], 'ochre')
    L.pattern(hat, 'stripes', 6, angle=60, bar=0.5, margin=2)
    L.contour(hat, 1.4); L.contour(body, 1.6)
    L.edge(1.6)
    boat.add('rower', L, 'hull', (-6, -14))
    L = sp.leather(-6, -6, 92, 10, k, ss=3, seed=sd())
    L.fill(L.stroke([(0, 0), (70, 0)], 3.4), 'brown')
    blade = L.fill(L.ellipse(80, 0, 13, 5), 'brown')
    L.punch(L.ellipse(80, 0, 6, 2), rim=0.6)
    L.edge(1.3)
    boat.add('oar', L, 'rower', (4, -30))
    boat.pose(oar=-38)
    boat.rod('rower', (0, -40), lean=-30, width=2.4)
    sp.place(boat, S(1170), S(800))
    _mirror(sp, boat, 'boat_refl', alpha=0.35, d=0.08, axis=800)
    sp.stage('boat')

    # ---- 7. mist: a cloud scenery piece (pale hide, ruyi cloud holes) held off the cloth so it goes soft
    L = sp.leather(-40, 590, 1300, 720, k, ss=2, seed=sd())
    top = [(x, 640 - 28 * (1 - x / 1300) + 8 * np.sin(x / 70)) for x in np.linspace(-40, 1300, 24)]
    bot = [(x, 662 + 26 * (1 - x / 1300) + 6 * np.sin(x / 55 + 1)) for x in np.linspace(1300, -40, 24)]
    cm = L.fill(np.array(top + bot), (1.0, 0.97, 0.9))
    L.pattern(cm, 'cloud', 34, margin=3, origin=(0, 650))
    sp.place(sp.prop(L, 'mist'), 0, 0, d=0.3, alpha=0.25)
    sp.stage('mist')

    # ---- 8. birds: little black-dyed gulls with a punched eye
    for bx, by, sz in [(1380, 260, 26), (1450, 225, 20), (1530, 285, 22), (1600, 200, 17), (1665, 250, 15)]:
        L = sp.leather(-sz - 4, -sz * 0.6, sz + 4, sz * 0.4, k, ss=4, seed=sd())
        w = L.fill(spline([(-sz, -sz * 0.18), (-sz * 0.5, -sz * 0.45), (0, -sz * 0.02), (sz * 0.5, -sz * 0.45),
                           (sz, -sz * 0.18), (sz * 0.5, -sz * 0.24), (0, sz * 0.2), (-sz * 0.5, -sz * 0.24)], 5),
                   (0.25, 0.18, 0.16))
        L.edge(1.2)
        sp.place(sp.prop(L, 'bird'), S(bx), S(by))
    sp.stage('birds')

    # ---- 9. reeds in the lower-left corner
    L = sp.leather(-10, 900, 330, 1090, k, ss=3, seed=sd())
    for i in range(16):
        x = rng.uniform(0, 300)
        top = rng.uniform(930, 990) - (300 - x) * 0.18
        lean = rng.uniform(-20, 30)
        blade = L.fill(L.ribbon(spline([(x, 1092), (x + lean * 0.4, (1092 + top) / 2), (x + lean, top)], 6), 14, 1.5),
                       (0.22, 0.42, 0.14))
    L.edge(1.4)
    sp.place(sp.prop(L, 'reeds'), 0, 0)
    sp.stage('reeds')

    img = sp.composite()
    if stages_dir:
        os.makedirs(stages_dir, exist_ok=True)
        for i, (name, im) in enumerate(sp.stages):
            im.save(os.path.join(stages_dir, f'{i:02d}_{name}.png'))
    return img


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else 'shadowpuppet_lake.png'
    W, H = (int(sys.argv[2]), int(sys.argv[3])) if len(sys.argv) > 3 else (1920, 1080)
    save_png(paint(W, H), out)
