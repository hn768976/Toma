"""Mountain lake at dusk — layered flat vector (FlatVector): stepped flat sky bands, faceted
mountain triangles, stacked-tier pines, flat mirrored reflections, translucent mist pills."""
import os
import sys
import time

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
import numpy as np

import drawkit
from drawkit import Scaler, seed_all, save_png
from flatvector import FlatVector, tone, mix, NIGHT, PLUM, BERRY, EMBER, SAND, PINE, CREAM

STYLE = "Flat vector · 扁平矢量"
LIB = "flatvector"

WL = 640
SUN = (1240, 560)
PINES_L = [(40, 560), (95, 515), (150, 470), (215, 430), (275, 455), (330, 495), (385, 470), (440, 520), (490, 548), (525, 565)]
PINES_R = [(1520, 585), (1568, 560), (1615, 592), (1708, 575), (1768, 600)]


def paint(W=1920, H=1080, seed=1, stages_dir=None):
    seed_all(seed)
    S = Scaler(W, H)
    s = S.s
    fv = FlatVector(W, H, seed=seed, light=(0.75, -0.25))     # low sun, right of centre
    rng = np.random.default_rng(seed + 5)
    P = lambda pts: S.pts(pts)

    def land(pts, colour, lift=0, bottom=None, shadow=0.36, alpha=1.0, texture=1.0):
        m = fv.profile(P(pts), bottom=None if bottom is None else S(bottom))
        return fv.fill(m, colour, alpha=alpha, lift=S(lift) if lift else 0, shadow=shadow, texture=texture)

    # ---------------------------------------------------------------- 1 sky: flat stepped dusk bands
    fv.backdrop(tone(NIGHT, -0.05))
    sky = [(105, mix(NIGHT, PLUM, 0.22)), (175, mix(NIGHT, PLUM, 0.5)), (235, mix(PLUM, BERRY, 0.25)),
           (285, mix(PLUM, BERRY, 0.6)), (330, mix(BERRY, EMBER, 0.5)), (372, mix(EMBER, SAND, 0.55)), (420, tone(SAND, 0.35))]
    for i, (y, col) in enumerate(sky):
        a = 14 + 4 * i
        land([(-60, y + a * 0.4), (420, y - a * 0.3), (900, y + a * 0.2), (1400, y - a * 0.4), (1980, y + a * 0.3)],
             col, bottom=WL + 2, texture=0.6)
    fv.glow(S(SUN[0]), S(400), S(380), S(150), tone(SAND, 0.55), rings=4, alpha=0.14)
    fv.fill(fv.circle(S(1180), S(372), S(56)), tone(SAND, 0.6), texture=0)     # the sun dipping behind the range
    fv.stage('sky')

    # ---------------------------------------------------------------- 2 far range: pale faceted peaks
    far = mix(PLUM, tone(BERRY, 0.4), 0.35)
    far = mix(far, CREAM, 0.18)
    for (pk, l, r, sd) in [((300, 345), (-200, WL), (720, WL), 1), ((820, 335), (480, WL), (1110, WL), 2),
                           ((1625, 340), (1360, WL), (2050, WL), 3), ((1250, 300), (880, WL), (1640, WL), 4)]:
        fv.mountain(S.pt(*pk), S.pt(*l), S.pt(*r), far, lift=S(5), shade=-0.1, seed=sd,
                    snow=0.12 if sd == 4 else 0.0)
    fv.stage('far_mountains')

    # ---------------------------------------------------------------- 3 near range: darker, left-heavy shoulder
    near = mix(tone(PLUM, -0.42), NIGHT, 0.3)
    land([(-60, 470), (160, 438), (360, 432), (560, 452), (760, 446), (960, 500), (1180, 560), (1400, 585),
          (1620, 545), (1760, 530), (1980, 568)], near, lift=9, bottom=WL + 2)
    # shade facets on the shoulder (flat, kinked)
    fv.fill(fv.poly(P([(360, 432), (420, 520), (380, 640), (560, 640), (560, 452)])) & fv.profile(P([(-60, 470), (160, 438), (360, 432), (560, 452), (760, 446), (960, 500), (1180, 560), (1400, 585), (1620, 545), (1760, 530), (1980, 568)]), bottom=S(WL + 2)),
            tone(near, -0.12), texture=0)
    fv.stage('near_mountains')

    # ---------------------------------------------------------------- 4 water: flat bands, darker toward the viewer
    water = [(WL, mix(mix(PLUM, BERRY, 0.45), SAND, 0.42)), (748, tone(PLUM, -0.3)), (820, mix(tone(PLUM, -0.45), NIGHT, 0.3)),
             (930, mix(NIGHT, PLUM, 0.25)), (1020, tone(NIGHT, -0.02))]
    for i, (y, col) in enumerate(water):
        land([(-60, y), (1980, y)] if i == 0 else [(-60, y + 6), (700, y - 4), (1300, y + 5), (1980, y - 3)],
             col, lift=0, texture=0.8)
    # mirrored ranges: flat, darker, squashed
    for (pk, l, r) in [((300, 345), (-200, WL), (720, WL)), ((820, 335), (480, WL), (1110, WL)),
                       ((1625, 340), (1360, WL), (2050, WL)), ((1250, 300), (880, WL), (1640, WL))]:
        fl = lambda p: (p[0], WL + (WL - p[1]) * 0.6)
        fv.fill(fv.poly(P([l, fl(pk), r]), round=S(6)), mix(far, tone(PLUM, -0.3), 0.55), alpha=0.75, texture=0)
    nr = [(-60, 470), (160, 438), (360, 432), (560, 452), (760, 446), (960, 500), (1180, 560), (1400, 585), (1620, 545), (1760, 530), (1980, 568)]
    from core import spline
    top = spline(P(nr), 24)
    refl = np.stack([top[:, 0], S(WL) + (S(WL) - top[:, 1]) * 0.6], 1)
    fv.fill(fv.poly(np.vstack([[[refl[0, 0], S(WL)]], refl, [[refl[-1, 0], S(WL)]]])), tone(near, -0.1), alpha=0.9, texture=0)
    # sun path: stepped flat glow + stacked capsules under the sun
    for k in range(9):
        y = 660 + k * 26
        L = 150 - k * 12 + rng.uniform(-20, 20)
        x = 1180 + rng.uniform(-18, 18)
        fv.fill(fv.capsule(S.pt(x - L / 2, y), S.pt(x + L / 2, y), S(3.2 - k * 0.15)), tone(SAND, 0.35 - k * 0.04),
                alpha=0.9 - k * 0.07, texture=0)
    fv.stage('water')

    # ---------------------------------------------------------------- 5 shores and pines
    shore = tone(PINE, -0.62)
    land([(-60, 630), (300, 626), (560, 636), (640, 650)], shore, lift=4, bottom=656)
    fv.fill(fv.poly(P([(1450, 652), (1520, 634), (1980, 630), (1980, 655)]), round=S(8)), shore, lift=S(4))
    pine_c = tone(PINE, -0.3)
    # reflections first: flat inverted tiers in a dark teal-violet, under the trees
    rc = mix(tone(PINE, -0.55), PLUM, 0.2)
    for (x, top) in PINES_L + PINES_R:
        h = 652 - top
        for j in range(3):
            t0 = 652 + 0.12 * h + j * h * 0.22
            half = h * 0.31 * (0.55 + 0.45 * (3 - j) / 3)
            t1 = t0 + h * 0.42
            if t0 > 880: continue
            fv.fill(fv.poly(P([(x - half, t0), (x, min(t1, 900)), (x + half, t0)]), round=S(3)), rc, alpha=0.8, texture=0)
    for (x, top) in sorted(PINES_L + PINES_R, key=lambda p: p[1]):
        fv.pine(S(x), S(652), S(652 - top), pine_c, tiers=3, lift=S(4))
    fv.stage('trees')

    # ---------------------------------------------------------------- 6 boat and rower
    hull_c = tone(EMBER, -0.35)
    # reflection
    fv.fill(fv.poly(P([(1100, 804), (1240, 804), (1258, 826), (1086, 828)]), round=S(6)), tone(hull_c, -0.45), alpha=0.7, texture=0)
    fv.fill(fv.capsule(S.pt(1172, 812), S.pt(1172, 842), S(9), S(5)), tone(NIGHT, 0.05), alpha=0.6, texture=0)
    # rower: body capsule + head + cap
    fv.fill(fv.capsule(S.pt(1172, 778), S.pt(1170, 750), S(12), S(9)), tone(PINE, -0.1), lift=S(3))
    fv.fill(fv.circle(S(1170), S(732), S(10)), mix(SAND, CREAM, 0.4), lift=S(2))
    fv.fill(fv.circle(S(1170), S(726), S(10)) & fv.rect(S(1155), S(712), S(1186), S(727)), EMBER, texture=0)
    fv.fill(fv.capsule(S.pt(1140, 770), S.pt(1108, 812), S(2.6)), tone(EMBER, -0.55), texture=0)      # oar
    hull = fv.poly(P([(1080, 776), (1262, 774), (1240, 801), (1102, 802)]), round=[S(4), S(4), S(10), S(10)])
    fv.fill(hull, hull_c, lift=S(5))
    fv.face(hull, S.pt(1080, 785), S.pt(1262, 785), tone(hull_c, -0.25))
    fv.fill(fv.capsule(S.pt(1084, 777), S.pt(1258, 775), S(2.4)), tone(EMBER, 0.15), texture=0)
    fv.stage('boat')

    # ---------------------------------------------------------------- 7 mist: translucent flat pills over the water
    mist_c = tone(mix(PLUM, CREAM, 0.6), 0.1)
    for (x0, x1, y, r, a) in [(-60, 700, 664, 14, 0.26), (-60, 420, 688, 10, 0.22), (140, 860, 706, 6, 0.18),
                              (600, 1000, 678, 5, 0.16), (1420, 1900, 664, 6, 0.18)]:
        fv.fill(fv.capsule(S.pt(x0, y), S.pt(x1, y), S(r)), mist_c, alpha=a, texture=0)
    fv.stage('mist')

    # ---------------------------------------------------------------- 8 ripples, reeds
    for i in range(18):
        y = 700 + 360 * rng.random() ** 0.9
        k = 0.4 + 0.6 * (y - WL) / 440
        L = rng.uniform(40, 130) * k
        x = rng.uniform(560, 1860)
        col = tone(PLUM, 0.15) if i % 2 else tone(PLUM, -0.15)
        fv.fill(fv.capsule(S.pt(x - L / 2, y), S.pt(x + L / 2, y), S(2.5 + 2 * k)), col, alpha=0.8, texture=0)
    reed = tone(PINE, -0.55)
    for i in range(16):
        x = 10 + i * 18 + rng.uniform(-5, 5)
        h = rng.uniform(70, 130) * (1.15 - i / 30)
        lean = rng.uniform(-0.3, 0.3)
        fv.fill(fv.poly(P([(x - 5, 1090), (x + lean * h * 0.6, 1080 - h), (x + 5, 1090)]), round=[0, S(1.5), 0]), reed, texture=0)
    for x, y in [(60, 965), (150, 985), (230, 1000)]:
        fv.fill(fv.capsule(S.pt(x, y), S.pt(x, y + 26), S(5)), tone(EMBER, -0.5), texture=0)       # cattail heads
    fv.stage('foreground')

    # ---------------------------------------------------------------- 9 birds: two tapered capsules each
    for (bx, by, sc) in [(1385, 232, 1.0), (1462, 198, 0.85), (1540, 262, 0.9), (1615, 214, 0.7), (1680, 285, 0.6)]:
        c = tone(NIGHT, -0.1)
        fv.fill(fv.capsule(S.pt(bx - 22 * sc, by - 10 * sc), S.pt(bx, by), S(1.2 * sc), S(2.6 * sc)), c, texture=0)
        fv.fill(fv.capsule(S.pt(bx, by), S.pt(bx + 22 * sc, by - 10 * sc), S(2.6 * sc), S(1.2 * sc)), c, texture=0)
    fv.stage('birds')

    img = fv.render()
    if stages_dir:
        os.makedirs(stages_dir, exist_ok=True)
        for i, (name, im) in enumerate(fv.stages):
            save_png(im, f"{stages_dir}/{i:02d}_{name}.png")
    return img


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else 'flatvector_lake.png'
    W = int(sys.argv[2]) if len(sys.argv) > 2 else 1920
    H = int(sys.argv[3]) if len(sys.argv) > 3 else 1080
    st = sys.argv[4] if len(sys.argv) > 4 else None
    t0 = time.perf_counter()
    img = paint(W, H, seed=1, stages_dir=st)
    print(f"paint {time.perf_counter() - t0:.2f}s")
    save_png(img, out)
