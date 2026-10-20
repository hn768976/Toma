"""Mountain lake at dusk — Roman mosaic (stone/glass tesserae, vermiculatum figures, tessellatum ground)."""
import os
import sys
import time

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
import drawkit  # noqa: E402  (sets sys.path to the skill lib)
from drawkit import Scaler, seed_all, save_png  # noqa: E402

import numpy as np  # noqa: E402
from mosaic import Mosaic, STONES  # noqa: E402
from core import spline  # noqa: E402

STYLE = "Roman mosaic"
LIB = "mosaic"

HORIZON = 640.0

# the box of stones: the Roman box plus the dusk colours a mosaicist would buy in for this panel
BOX = dict(STONES)
BOX.update({
    'indigo': ('#2c2b52', 'glass'), 'dusk': ('#433a6c', 'glass'), 'violet': ('#634d80', 'glass'),
    'plum': ('#86577e', 'marble'), 'mauve': ('#a87a92', 'marble'), 'lilac': ('#b9a0b8', 'marble'),
    'heather': ('#8c7d9c', 'stone'), 'peach': ('#eaa77c', 'marble'), 'apricot': ('#f2c18c', 'marble'),
    'coral': ('#d77a6c', 'marble'), 'pine': ('#24342f', 'stone'), 'moss': ('#3d5245', 'stone'),
    'ink': ('#1b1e33', 'glass'), 'mist': ('#ddc9cc', 'marble'),
})


def far_ridge(x):
    return (420 - 118 * np.exp(-((x - 1250) / 230) ** 2) - 70 * np.exp(-((x - 760) / 190) ** 2)
            - 55 * np.exp(-((x - 260) / 200) ** 2) - 62 * np.exp(-((x - 1700) / 170) ** 2)
            + 7 * np.sin(x / 31.0) + 4 * np.sin(x / 13.0 + 1.3))


def near_ridge(x):
    return (612 - 160 * np.exp(-((x - 400) / 430) ** 2) - 62 * np.exp(-((x - 980) / 170) ** 2)
            - 52 * np.exp(-((x - 1760) / 190) ** 2) + 8 * np.sin(x / 23.0) + 5 * np.sin(x / 9.0 + 0.7))


# pines: (centre x, top y, half-width at base, root y)
PINES = [(85, 470, 52, 652), (170, 422, 66, 656), (255, 495, 50, 652), (330, 440, 62, 656),
         (410, 515, 46, 651), (470, 478, 52, 654), (520, 552, 36, 650),
         (1530, 578, 28, 646), (1592, 552, 34, 647), (1652, 590, 24, 645), (1765, 566, 30, 646)]


def pine_outline(cx, top, hw, root):
    """a conifer silhouette: tiers of drooping branches, a short trunk"""
    h = root - top
    tiers = 4 if h > 120 else 3
    left, right = [], []
    for t in range(tiers):
        y_tip = top + h * 0.85 * (t + 1) / tiers
        y_in = top + h * 0.85 * (t + 0.72) / tiers
        w = hw * (t + 1) / tiers
        left += [(cx - w * 0.55, y_in), (cx - w, y_tip)]
        right += [(cx + w * 0.55, y_in), (cx + w, y_tip)]
    tw = max(5, hw * 0.12)
    yb = top + h * 0.85
    pts = [(cx, top)] + right + [(cx + tw, yb), (cx + tw, root), (cx - tw, root), (cx - tw, yb)] + left[::-1]
    return pts


def paint(W=1920, H=1080, seed=1, stages_dir=None):
    seed_all(seed)
    S = Scaler(W, H)
    s = S.s
    m = Mosaic(W, H, seed=seed, tile=13 * s, gap=1.8 * s, ss=2, stones=BOX)
    rng = m.rng
    YY, XX = np.mgrid[0:H, 0:W].astype(np.float32)
    Xd, Yd = XX / s, YY / s                                   # design coordinates of every pixel
    FIG = 7.5 * s
    hz = HORIZON * s

    xs = np.linspace(0, 1920, 97)
    sea = (YY >= hz).astype(np.float32)
    sky = 1 - sea
    far = m.poly_mask(S.pts([(-10, HORIZON + 2)] + list(zip(xs, far_ridge(xs))) + [(1930, HORIZON + 2)]))
    near = m.poly_mask(S.pts([(-10, HORIZON + 2)] + list(zip(xs, near_ridge(xs))) + [(1930, HORIZON + 2)]))
    pines = [m.poly_mask(S.pts(pine_outline(*p))) for p in PINES]
    pine_all = np.clip(sum(pines), 0, 1)
    far_only = far * (1 - near)
    near_only = near * (1 - pine_all)

    # ---------------------------------------------------------------- the cartoon
    m.paint(np.ones((H, W), np.float32), 'white')
    t = np.clip(YY / hz, 0, 1)
    stops = [(0.0, 'indigo'), (0.2, 'dusk'), (0.34, 'violet'), (0.45, 'plum'), (0.53, 'coral'), (0.62, 'peach'),
             (1.0, 'apricot')]
    for (t0, c0), (t1, c1) in zip(stops[:-1], stops[1:]):
        band = sky * (t >= t0) * (t < t1 + 1e-6)
        m.shade(band, c0, c1, (0, t0 * hz), (0, t1 * hz))
    glow = np.exp(-(((Xd - 1240) / 330) ** 2 + ((Yd - 430) / 150) ** 2)) * sky
    m.paint(glow * 0.75, 'apricot')
    m.shade(far_only, 'heather', 'mauve', (0, 300 * s), (0, hz))
    m.paint(far_only * (Xd > 1250) * (Yd < far_ridge(Xd) + 140) * 0.45, 'violet')     # shade side of the high peak
    m.shade(near_only, 'violet', 'dusk', (0, 430 * s), (0, hz))
    m.paint(near_only * (Xd > 520) * (Xd < 900) * np.clip(1 - (Yd - near_ridge(Xd)) / 120, 0, 1) * 0.6, 'plum')
    for p, pm in zip(PINES, pines):
        m.shade(pm, 'moss', 'pine', S.pt(p[0] - p[2], 0), S.pt(p[0] + p[2] * 0.3, 0))
    # water: the land and sky mirrored in it, darker toward the viewer, and a band of mist
    src_y = np.clip((2 * hz - YY).astype(int), 0, H - 1)
    refl = m.cartoon[src_y, np.arange(W)[None, :]]
    d = np.clip((Yd - HORIZON) / (1080 - HORIZON), 0, 1)[..., None]
    deep = m._col('ink')
    water = refl * 0.86 * (1 - 0.65 * d) + deep * 0.65 * d
    m.cartoon = np.where(sea[..., None] > 0.5, water, m.cartoon).astype(np.float32)
    mx = 1 - 0.7 * Xd / 1920
    mist = np.exp(-((Yd - 650) / (16 + 30 * mx)) ** 2) * mx * (0.75 + 0.25 * np.sin(Xd / 150.0)) * (1 - pine_all)
    m.paint(np.clip(mist, 0, 1) * 0.8, 'mist')

    # boat, rower, oars (design coords)
    hull = m.poly_mask(S.pts(spline([(1072, 776), (1120, 784), (1170, 786), (1220, 783), (1266, 770),
                                     (1246, 798), (1200, 808), (1130, 808), (1092, 798), (1072, 776)], 6)))
    m.shade(hull, 'brown', 'umber', S.pt(0, 776), S.pt(0, 808))
    body = m.poly_mask(S.pts([(1154, 778), (1184, 778), (1180, 744), (1158, 744)]))
    m.paint(body, 'navy')
    head = m.ellipse(*S.pt(1169, 732), 11 * s, 11 * s)
    m.paint(head, 'umber')
    boat_refl = m.poly_mask(S.pts(spline([(1092, 812), (1130, 818), (1200, 818), (1246, 812), (1236, 836),
                                          (1180, 846), (1120, 844), (1092, 812)], 6)))
    m.paint(boat_refl * 0.8, 'ink')

    birds = [(1420, 210, 50, 4), (1500, 250, 40, -6), (1575, 190, 54, 8), (1640, 272, 34, -4), (1365, 285, 36, 2)]

    def bird_strokes(cx, cy, w, ang):
        a = np.radians(ang); c_, s_ = np.cos(a), np.sin(a)
        rot = lambda P: [S.pt(cx + x * c_ + y * s_, cy - x * s_ + y * c_) for x, y in P]
        return [rot([(-w / 2, -w * 0.05), (-w * 0.3, -w * 0.22), (-w * 0.1, -w * 0.14), (0, 0)]),
                rot([(0, 0), (w * 0.1, -w * 0.15), (w * 0.3, -w * 0.23), (w / 2, -w * 0.06)])]

    # ---------------------------------------------------------------- 1. sinopia
    for msk in [far, near, hull, body] + pines:
        m.sinopia(msk, width=3.0 * s)
    m.sinopia(pts=S.pts([(0, HORIZON), (1920, HORIZON)]), width=2.4 * s, strength=0.45)
    m.stage('sinopia')

    # ---------------------------------------------------------------- 2. pines (vermiculatum, dark contour row)
    for pm in pines:
        m.outline(pm, 'ink', 1, FIG * 0.9)
    for pm in pines:
        m.fill(pm, FIG * 0.9, stones=['pine', 'moss', 'green', 'black'])
    m.stage('trees')

    # ---------------------------------------------------------------- 3. boat and rower
    m.outline(head, 'black', 1, FIG * 0.8)
    m.fill(head, FIG * 0.8)
    m.outline(body, 'black', 1, FIG * 0.8)
    m.fill(body, FIG * 0.8)
    m.line(S.pts([(1080, 782), (1170, 790), (1258, 776)]), 'ochre', FIG * 0.8, across=FIG * 0.7)
    m.outline(hull, 'black', 1, FIG * 0.85)
    m.fill(hull, FIG * 0.85)
    m.line(S.pts([(1160, 768), (1104, 822)]), 'buff', FIG * 0.75, across=FIG * 0.6, smooth=False)
    m.line(S.pts([(1180, 768), (1238, 824)]), 'buff', FIG * 0.75, across=FIG * 0.6, smooth=False)
    m.stage('boat')

    # ---------------------------------------------------------------- 4. mountains: near then far
    m.outline(near_only, 'indigo', 1, FIG)
    m.fill(near_only, FIG * 1.1, stones=['violet', 'dusk', 'plum', 'heather', 'indigo', 'mauve', 'mist'])
    m.stage('near_mountains')
    m.outline(far_only, 'heather', 1, FIG)
    m.fill(far_only, FIG * 1.2, stones=['heather', 'mauve', 'lilac', 'violet', 'plum', 'mist', 'rose'])
    m.stage('far_mountains')

    # ---------------------------------------------------------------- 5. birds
    for b in birds:
        for p in bird_strokes(*b):
            m.line(p, 'indigo', 6.5 * s, across=6 * s)
    m.stage('birds')

    # ---------------------------------------------------------------- 6. sky: a halo round everything, then rows
    sky_st = ['indigo', 'dusk', 'violet', 'plum', 'coral', 'peach', 'apricot', 'rose', 'mauve', 'gold', 'yellow']
    m.halo(sky, rows=1, size=11 * s, stones=sky_st)
    m.rows(sky, size=12.5 * s, wobble=6 * s, stones=sky_st)
    m.stage('sky')

    # ---------------------------------------------------------------- 6b. reeds, lower left
    for k in range(12):
        x = 30 + k * 22 + rng.uniform(-6, 6)
        top = 960 + rng.uniform(0, 50) + k * 4
        lean = rng.uniform(-24, 36)
        pts = [(x, 1090), (x + lean * 0.3, (1080 + top) / 2), (x + lean, top)]
        m.line(S.pts(pts), ['pine', 'moss', 'umber'][k % 3], 6 * s, across=5.5 * s, keep=0.4)
    m.stage('reeds')

    # ---------------------------------------------------------------- 7. water: ripple lines, mist, wavy rows
    for k in range(22):
        y = 690 + (k / 22) ** 1.25 * 360 + rng.uniform(-8, 8)
        x0 = rng.uniform(80, 1700)
        L = rng.uniform(70, 200) * (0.7 + (y - 640) / 400)
        if 1040 < x0 + L and x0 < 1290 and 760 < y < 860:
            continue
        pts = [(x0 + u, y + 3 * np.sin(u / 18.0)) for u in np.linspace(0, L, 10)]
        m.line(S.pts(pts), 'apricot' if (y < 880 and k % 3) else 'mist', 7 * s, across=6 * s, keep=0.6)
    sea_st = ['ink', 'indigo', 'dusk', 'violet', 'plum', 'mauve', 'heather', 'coral', 'peach', 'pine', 'mist', 'lilac']
    m.halo(sea, rows=1, size=11 * s, stones=sea_st)
    wav = YY - 5 * s * np.sin(XX / (38.0 * s) + YY / (60.0 * s))
    m.rows(sea, size=11 * s, field=wav, stones=sea_st)
    m.stage('water')

    m.patina(0.5)
    if stages_dir:
        os.makedirs(stages_dir, exist_ok=True)
        return m.save(os.path.join(stages_dir, 'final_ss.png'), stages_dir=stages_dir)
    return m._render(m.ss, aged=True)


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else 'mosaic_lake.png'
    W = int(sys.argv[2]) if len(sys.argv) > 2 else 1920
    H = int(sys.argv[3]) if len(sys.argv) > 3 else 1080
    t0 = time.perf_counter()
    im = paint(W, H)
    print('paint %.2fs' % (time.perf_counter() - t0))
    save_png(im, out)
