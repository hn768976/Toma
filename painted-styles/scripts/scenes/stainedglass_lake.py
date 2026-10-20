"""Mountain lake at dusk — Stained glass: one full-bleed leaded panel (pot-metal glass, grisaille, silver stain)."""
import os
import sys
import time

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
import drawkit  # noqa: E402  (sets sys.path to the skill lib)
from drawkit import Scaler, seed_all, save_png  # noqa: E402

import numpy as np  # noqa: E402
from stainedglass import StainedGlass  # noqa: E402

STYLE = "Stained glass"
LIB = "stainedglass"

HORIZON = 640.0
SUN = (1240.0, 500.0)


def far_ridge(x):
    return (420 - 118 * np.exp(-((x - 1250) / 230) ** 2) - 70 * np.exp(-((x - 760) / 190) ** 2)
            - 55 * np.exp(-((x - 260) / 200) ** 2) - 62 * np.exp(-((x - 1700) / 170) ** 2)
            + 6 * np.sin(x / 47.0) + 3 * np.sin(x / 19.0 + 1.3))


def near_ridge(x):
    return (612 - 160 * np.exp(-((x - 400) / 430) ** 2) - 62 * np.exp(-((x - 980) / 170) ** 2)
            - 52 * np.exp(-((x - 1760) / 190) ** 2) + 7 * np.sin(x / 33.0) + 4 * np.sin(x / 14.0 + 0.7))


PINES = [(85, 470, 52, 652), (170, 422, 66, 656), (255, 495, 50, 652), (330, 440, 62, 656),
         (410, 515, 46, 651), (470, 478, 52, 654), (520, 552, 36, 650),
         (1530, 578, 28, 646), (1592, 552, 34, 647), (1652, 590, 24, 645), (1765, 566, 30, 646)]


def pine_outline(cx, top, hw, root, flip=False):
    """conifer silhouette (tiers of drooping branches); flip=True mirrors it about the waterline"""
    h = root - top
    tiers = 4 if h > 120 else 3
    left, right = [], []
    for t in range(tiers):
        y_tip = top + h * 0.86 * (t + 1) / tiers
        y_in = top + h * 0.86 * (t + 0.7) / tiers
        w = hw * (t + 1) / tiers
        left += [(cx - w * 0.5, y_in), (cx - w, y_tip)]
        right += [(cx + w * 0.5, y_in), (cx + w, y_tip)]
    yb = top + h * 0.86
    tw = max(6, hw * 0.13)
    pts = [(cx, top)] + right + [(cx + tw, yb), (cx + tw, root + 4), (cx - tw, root + 4), (cx - tw, yb)] + left[::-1]
    if flip:
        pts = [(x, 2 * HORIZON - y) for x, y in pts]
    return pts


def ridge_pts(fn, x0=-20, x1=1940, n=120, flip=False, squash=1.0):
    xs = np.linspace(x0, x1, n)
    ys = fn(xs)
    if flip:
        ys = HORIZON + (HORIZON - ys) * squash
        return [(x0, HORIZON - 2)] + list(zip(xs, ys)) + [(x1, HORIZON - 2)]
    return [(x0, HORIZON + 2)] + list(zip(xs, ys)) + [(x1, HORIZON + 2)]


def wavy_band(S, y0, y1, amp, k, x0=-20, x1=1940, n=60):
    xs = np.linspace(x0, x1, n)
    top = y0 + amp * np.sin(xs / k + 0.4) if y0 > 0 else np.full(n, -20.0)
    bot = y1 + amp * np.sin(xs / k + 2.1) if y1 < 1080 else np.full(n, 1100.0)
    return S.pts(list(zip(xs, top)) + list(zip(xs[::-1], bot[::-1])))


def paint(W=1920, H=1080, seed=1, stages_dir=None):
    seed_all(seed)
    S = Scaler(W, H)
    s = S.s
    g = StainedGlass(W, H, seed=seed, record=bool(stages_dir), ambient=0.08)
    g.win[:] = 1.0                                   # the whole frame is one leaded panel: no wall, no arch
    rng = np.random.default_rng(seed + 7)
    sun = S.pt(*SUN)

    # ================================================================ glass, back to front
    # ---- sky: bands of pot-metal glass from deep blue to gold, the low ones cut radially round the sun
    glow = (SUN[0], 430.0)                            # the sun has just gone behind the high peak
    bands = [(['#1d2a6e', '#243380', '#1a2766'], None), (['#3a3488', '#4a3a8a', '#33307a'], None),
             (['#7a2c5c', '#8a3466', '#6e2a5a'], None), (['#c0405a', '#b3182c', '#cc5a5a'], glow),
             (['#d0601e', '#e0922a', '#d8702a'], glow), (['#f2c230', '#e8a830', '#f4d060'], glow)]
    edges = [-20, 115, 195, 272, 330, 385, 700]
    xs = np.linspace(-20, 1940, 60)
    curve = lambda k: (np.full(len(xs), float(edges[k])) if k in (0, len(edges) - 1)
                       else edges[k] + 9 * np.sin(xs / 140.0 + 0.9 * k))
    for k, (cols, around) in enumerate(bands):
        m = g.poly(S.pts(list(zip(xs, curve(k))) + list(zip(xs[::-1], curve(k + 1)[::-1]))))
        if around is None:
            g.glass(m, cols, cell=78 * s, streak=0.6, aspect=1.6, angle=0.05)
        else:
            g.glass(m, cols, cell=58 * s, around=S.pt(*around), streak=0.5, flashed=cols[1] == '#b3182c')
    # ---- far range: pale, hazy lavender-blue
    far = g.poly(S.pts(ridge_pts(far_ridge)))
    g.glass(far, ['#8a74aa', '#7c6aa0', '#9580b4'], cell=72 * s, streak=0.5, aspect=1.3, angle=-0.3)
    # ---- near range: deep violet, left-heavy
    near = g.poly(S.pts(ridge_pts(near_ridge)))
    g.glass(near, ['#3c2f6e', '#46337a', '#33296a'], cell=84 * s, streak=0.5, aspect=1.4, angle=0.2)
    # ---- pines (one glass area of mixed dark greens; trunks are cut in brown)
    pines = np.clip(sum(g.poly(S.pts(pine_outline(*p))) for p in PINES), 0, 1)
    g.glass(pines, ['#1f5a3a', '#2a6a40', '#18492f', '#245236'], cell=30 * s, aspect=1.5, angle=np.pi / 2,
            streak=0.5, streak_dir=np.pi / 2)
    # ---- water: bands, darker toward the viewer, cut in long horizontal pieces
    wbands = [(640, 740, ['#b04a5a', '#9a3a6a', '#c0605a']), (740, 880, ['#4a3a86', '#3a3480', '#55408a']),
              (880, 1080, ['#1d2a6e', '#172560', '#22306f'])]
    wcurve = lambda y: np.full(len(xs), float(y)) if y in (640, 1080) else y + 7 * np.sin(xs / 90.0 + y)
    for (y0, y1, cols) in wbands:
        y1_ = y1 + 20 if y1 == 1080 else y1
        m = g.poly(S.pts(list(zip(xs, wcurve(y0))) + list(zip(xs[::-1], wcurve(y1)[::-1] + (20 if y1 == 1080 else 0)))))
        g.glass(m, cols, cell=70 * s, aspect=2.6, angle=0.0, streak=0.6, streak_dir=0.0)
    # reflections: the near range and the pines mirrored, squashed and darker; a broken sun glitter
    nref = g.poly(S.pts(ridge_pts(near_ridge, flip=True, squash=0.8)))
    g.glass(nref, ['#2c2766', '#352a6c', '#282460'], cell=70 * s, aspect=2.4, angle=0.0, streak_dir=0.0)
    pref = np.clip(sum(g.poly(S.pts(pine_outline(*p, flip=True))) for p in PINES), 0, 1)
    g.glass(pref, ['#173a34', '#1c4438', '#143030'], cell=34 * s, aspect=2.0, angle=0.0, streak_dir=0.0)
    for k in range(9):
        y = 662 + k * 26 + rng.uniform(-4, 4)
        w = (95 - k * 8) * rng.uniform(0.8, 1.15)
        g.glass(g.ellipse(*S.pt(SUN[0] + rng.uniform(-12, 12), y), w * s, 7.5 * s), ['#f2c230', '#e0922a'][k % 2],
                streak=0.3, streak_dir=0.0)
    # ---- mist: opalescent pale glass drifting over the far shore, thicker at the left
    xs = np.linspace(-20, 1940, 70)
    thick = 44 * (1 - 0.8 * xs / 1920) + 8 * np.sin(xs / 85.0)
    top = 628 - thick * 0.55 + 6 * np.sin(xs / 51.0)
    bot = 650 + thick * 0.6 + 5 * np.sin(xs / 37.0 + 1)
    mist = g.poly(S.pts(list(zip(xs, top)) + list(zip(xs[::-1], bot[::-1]))))
    mist = mist * (1 - pines * (g.YY < 600 * s))
    g.glass(mist, ['#b8a0cc', '#c6aed0', '#ad98c4'], cell=64 * s, aspect=3.0, angle=0.0, streak=0.3, seeds=0.6)
    # ---- birds: gull silhouettes cut in dark glass (thin painted lines vanish on the dusk sky)
    for (bx, by, sc, fl) in [(1420, 210, 1.0, 1), (1500, 250, 0.8, 0.5), (1575, 190, 1.1, 0.9), (1640, 272, 0.7, 0.7),
                             (1365, 285, 0.75, 1)]:
        w_ = 40 * sc
        up = [(-w_, -0.45 * w_ * fl), (-0.55 * w_, -0.36 * w_), (-0.15 * w_, -0.1 * w_), (0, -0.02 * w_),
              (0.15 * w_, -0.1 * w_), (0.55 * w_, -0.36 * w_), (w_, -0.45 * w_ * fl)]
        lo = [(0.55 * w_, -0.16 * w_), (0.16 * w_, 0.1 * w_), (0, 0.2 * w_), (-0.16 * w_, 0.1 * w_), (-0.55 * w_, -0.16 * w_)]
        g.glass(g.poly(S.pts([(bx + x, by + y) for x, y in up + lo])), '#1c1a40', streak=0.2, seeds=0.2)
    # ---- boat, rower, reflection
    hull_pts = [(1072, 776), (1120, 784), (1170, 787), (1220, 784), (1266, 770), (1248, 797), (1200, 808),
                (1130, 808), (1094, 798)]
    hull = g.poly(S.pts(hull_pts))
    g.glass(g.poly(S.pts([(1094, 812), (1246, 812), (1232, 836), (1110, 838)])), '#2a1a30', streak=0.3)
    g.glass(hull, ['#7a4e2c', '#6e4526'], cell=60 * s, aspect=2.0, streak_dir=0.0)
    body = g.poly(S.pts([(1152, 780), (1186, 780), (1182, 742), (1158, 742)]))
    g.glass(body, '#173c8f', streak=0.4)
    head = g.circle(*S.pt(1170, 728), 13 * s)
    g.glass(head, '#e9c9a8', streak=0.2)
    g.stage('cartoon', cartoon=True)
    g.stage('glass')

    # ================================================================ grisaille trace lines
    # ridge contours and a few rock seams
    for fn, wd in ((far_ridge, 2.2), (near_ridge, 2.6)):
        xs = np.linspace(0, 1920, 200)
        g.trace(S.pts(list(zip(xs, fn(xs)))), wd * s, taper=(0.02, 0.02), wobble=0.4 * s)
    for (x, y, dx, dy) in [(1250, 310, -60, 120), (1250, 310, 70, 110), (760, 352, -40, 90), (1700, 360, 40, 80),
                           (420, 460, -50, 100), (980, 556, 40, 60)]:
        g.trace(S.pts([(x, y + 6), (x + dx * 0.5, y + dy * 0.45), (x + dx, y + dy)]), 1.8 * s, taper=(0.1, 0.8))
    # pines: a scalloped branch line along every tier, a trunk line
    for (cx, top, hw, root) in PINES:
        h = root - top
        tiers = 4 if h > 120 else 3
        for t in range(tiers):
            y_tip = top + h * 0.86 * (t + 1) / tiers
            w = hw * (t + 1) / tiers * 0.92
            xs = np.linspace(cx - w, cx + w, 12)
            ys = y_tip - 3 - 4 * np.abs(np.sin((xs - cx) / max(w, 1) * np.pi * 1.5))
            g.trace(S.pts(list(zip(xs, ys))), 1.8 * s, taper=(0.3, 0.3), wobble=0.3 * s)
        g.trace(S.pts([(cx, top + 10), (cx, top + h * 0.86)]), 1.6 * s, taper=(0.6, 0.1))
    # boat: gunwale, planks, oars, face shadow
    g.trace(S.pts([(1072, 776), (1170, 787), (1266, 770)]), 3.2 * s, taper=(0.1, 0.1))
    g.trace(S.pts([(1092, 793), (1170, 799), (1250, 790)]), 1.6 * s, taper=(0.2, 0.2))
    g.trace(S.pts([(1160, 765), (1100, 826)]), 4.2 * s, taper=(0.1, 0.4), smooth=False)
    g.trace(S.pts([(1180, 765), (1242, 828)]), 4.2 * s, taper=(0.1, 0.4), smooth=False)
    g.trace(S.pts([(1158, 760), (1172, 770), (1184, 760)]), 2.0 * s)
    g.trace(S.pts([(1158, 724), (1166, 716), (1180, 720), (1182, 732)]), 3.0 * s)          # hair / cap
    # reeds, lower left: painted blades and seed heads
    for k in range(16):
        x = 18 + k * 18 + rng.uniform(-6, 6)
        top = 950 + rng.uniform(0, 60) + k * 3
        lean = rng.uniform(-30, 40)
        g.trace(S.pts([(x, 1090), (x + lean * 0.3, (1080 + top) / 2), (x + lean, top)]), 3.4 * s, taper=(0.0, 0.9))
        if k % 4 == 1:
            g.trace(S.pts([(x + lean, top - 2), (x + lean * 1.05, top - 22)]), 6.5 * s, taper=(0.4, 0.4))
    g.stage('trace')

    # ================================================================ matt, sticklight, silver stain
    yy = g.YY / s
    xx = g.XX / s
    g.matt(np.clip((150 - yy) / 150, 0, 1), 0.25, soft=20 * s)                  # the zenith deepens
    g.shade(far, offset=(-26 * s, -8 * s), strength=0.35, soft=12 * s, clip=far * (xx > 1250))  # lee side of the peaks
    g.matt(near * np.clip((yy - near_ridge(xx)) / 140, 0, 1), 0.35, soft=6 * s)
    g.shade(pines, offset=(10 * s, 0), strength=0.45, soft=3 * s)
    water = (yy > HORIZON).astype(np.float32)
    g.matt(water * np.clip((yy - 700) / 380, 0, 1), 0.45, soft=10 * s)
    for k in range(34):                                                           # ripples lifted out of the matt
        y = 700 + (k / 34) ** 1.2 * 360 + rng.uniform(-6, 6)
        x0 = rng.uniform(40, 1800)
        L = rng.uniform(60, 200) * (0.6 + (y - 640) / 440)
        if x0 + L > 1060 and x0 < 1280 and 760 < y < 850:
            continue
        g.scratch(S.pts([(x0, y), (x0 + L * 0.5, y + 1.5), (x0 + L, y)]), 2.2 * s)
    g.matt(hull, 0.3, soft=2 * s)
    g.scratch(S.pts([(1100, 784), (1160, 790), (1230, 784)]), 2.0 * s)
    g.stain(mist * np.clip((xx - 700) / 900, 0, 1) * 0.5, 0.6)                  # the mist catches the sun
    g.stage('matt')

    # ================================================================ lead, weather, daylight
    g.lead(width=6.0 * s, rim=0.0)
    g.stage('lead')
    g.weather(grime=0.35, pits=0.3)
    g.daylight(strength=1.0, spill=1.0, halation=1.0, sky=('#ffffff', '#f2eee6'))
    img = g.composite()
    if stages_dir:
        os.makedirs(stages_dir, exist_ok=True)
        for i, (name, im) in enumerate(g.stages):
            save_png(im, os.path.join(stages_dir, '%02d_%s.png' % (i, name)))
    return img


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else 'stainedglass_lake.png'
    W = int(sys.argv[2]) if len(sys.argv) > 2 else 1920
    H = int(sys.argv[3]) if len(sys.argv) > 3 else 1080
    t0 = time.perf_counter()
    im = paint(W, H)
    print('paint %.2fs' % (time.perf_counter() - t0))
    save_png(im, out)
