"""Mountain lake — Stained glass (彩色玻璃花窗): one full-bleed leaded panel (pot-metal glass, grisaille,
silver stain), painted with vendor lib/stainedglass.py `StainedGlass` (via scenes/_stainedglass_kit.Panel).

Phase 2: bleed-aware, layer groups with per-group RNG (each group's glass cut on its own outline), two
colourways (Day / Dusk; Dusk = the Phase 1 look), dense draw-on stages.

python scripts/scenes/stainedglass_lake.py out.png [W H] [colourway] [bleed]
"""
import os
import sys
import time

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import drawkit  # noqa: E402  (sets sys.path to the skill lib)
from drawkit import Scaler, seed_all, save_png  # noqa: E402

import numpy as np  # noqa: E402
from _stainedglass_kit import Panel, Stager, hband, design_xy  # noqa: E402

STYLE = "Stained glass · 彩色玻璃花窗"
LIB = "stainedglass"
COLOURWAYS = ("Day", "Dusk")
GROUPS = ("sky", "clouds", "far", "near", "water", "mist", "boat", "birds", "reeds")

HORIZON = 640.0

PAL = {
    "Dusk": dict(
        bands=[['#1d2a6e', '#243380', '#1a2766'], ['#3a3488', '#4a3a8a', '#33307a'], ['#7a2c5c', '#8a3466', '#6e2a5a'],
               ['#c0405a', '#b3182c', '#cc5a5a'], ['#d0601e', '#e0922a', '#d8702a'], ['#f2c230', '#e8a830', '#f4d060']],
        glow=(1240.0, 430.0), radial=(3, 4, 5), sun=None,
        cloud=['#c86a8c', '#d88aa0', '#b8608a'], cloud_lit='below',
        far=['#8a74aa', '#7c6aa0', '#9580b4'], near=['#3c2f6e', '#46337a', '#33296a'],
        pines=['#1f5a3a', '#2a6a40', '#18492f', '#245236'], shore=['#2a2450', '#30285a'],
        water=[['#b04a5a', '#9a3a6a', '#c0605a'], ['#4a3a86', '#3a3480', '#55408a'], ['#1d2a6e', '#172560', '#22306f']],
        nref=['#2c2766', '#352a6c', '#282460'], pref=['#173a34', '#1c4438', '#143030'],
        glit=['#f2c230', '#e0922a'], glit_x=1240.0,
        mist=['#b8a0cc', '#c6aed0', '#ad98c4'], mist_stain=0.6,
        hull=['#7a4e2c', '#6e4526'], hull_ref='#2a1a30', body='#173c8f', head='#e9c9a8', bird='#1c1a40',
        sky=('#ffffff', '#f2eee6')),
    "Day": dict(
        bands=[['#1f4fa8', '#2456b0', '#1d4a9e'], ['#3368b8', '#3d74c2', '#2f60b0'], ['#5d8fd0', '#6a9ad6', '#5588cc'],
               ['#86b0de', '#93bae2', '#7ca8da'], ['#aecde8', '#bcd6ec', '#a4c6e4'], ['#dfe8e0', '#e8ecdc', '#d7e2ea']],
        glow=None, radial=(), sun=(640.0, 138.0, 44.0),
        cloud=['#eeeadb', '#f4f1e6', '#e2e6ea'], cloud_lit='above',
        far=['#a39ec0', '#968fb8', '#aca8c8'], near=['#3f6f68', '#4a7a70', '#365f5a'],
        pines=['#2f8a3c', '#2a6a40', '#1f5a3a', '#3a7a3a'], shore=['#5a5a3a', '#66603e'],
        water=[['#a4c6e4', '#93bae2', '#b4d0ea'], ['#4a7cc8', '#3d70bf', '#5588cc'], ['#1f4fa8', '#1d4a9e', '#24539e']],
        nref=['#2f5a62', '#36606a', '#2a5058'], pref=['#1f4a38', '#244e3c', '#1a4030'],
        glit=['#eeeadb', '#d7e2ea'], glit_x=640.0,
        mist=['#e4e9f0', '#eeeadb', '#d7e2ea'], mist_stain=0.25,
        hull=['#7a4e2c', '#6e4526'], hull_ref='#1a3060', body='#b3182c', head='#e9c9a8', bird='#22223a',
        sky=('#ffffff', '#f2eee6')),
}

CLOUDS = [(260, 102, 400, 34), (900, 172, 330, 26), (1480, 86, 460, 36), (1160, 250, 250, 20)]
BIRDS = [(1420, 210, 1.0, 1), (1500, 250, 0.8, 0.5), (1575, 190, 1.1, 0.9), (1640, 272, 0.7, 0.7), (1365, 285, 0.75, 1)]
PINES = [(85, 470, 52, 652), (170, 422, 66, 656), (255, 495, 50, 652), (330, 440, 62, 656),
         (410, 515, 46, 651), (470, 478, 52, 654), (520, 552, 36, 650),
         (1530, 578, 28, 646), (1592, 552, 34, 647), (1652, 590, 24, 645), (1765, 566, 30, 646)]


def far_ridge(x):
    return (420 - 118 * np.exp(-((x - 1250) / 230) ** 2) - 70 * np.exp(-((x - 760) / 190) ** 2)
            - 55 * np.exp(-((x - 260) / 200) ** 2) - 62 * np.exp(-((x - 1700) / 170) ** 2)
            + 6 * np.sin(x / 47.0) + 3 * np.sin(x / 19.0 + 1.3))


def near_ridge(x):
    return (612 - 160 * np.exp(-((x - 400) / 430) ** 2) - 62 * np.exp(-((x - 980) / 170) ** 2)
            - 52 * np.exp(-((x - 1760) / 190) ** 2) + 7 * np.sin(x / 33.0) + 4 * np.sin(x / 14.0 + 0.7))


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


def ridge_pts(S, fn, n=140, flip=False, squash=1.0):
    x0, x1 = S.X0 - 30, S.X1 + 30
    xs = np.linspace(x0, x1, n)
    ys = fn(xs)
    if flip:
        ys = HORIZON + (HORIZON - ys) * squash
        return [(x0, HORIZON - 2)] + list(zip(xs, ys)) + [(x1, HORIZON - 2)]
    return [(x0, HORIZON + 2)] + list(zip(xs, ys)) + [(x1, HORIZON + 2)]


def cloud_pts(cx, cy, L, h, phase=0.0):
    """a thin high cloud: a long lens, lumpy along the top, nearly flat underneath"""
    t = np.linspace(-1, 1, 40)
    env = np.clip(1 - t ** 2, 0, 1) ** 0.7
    top = cy - h * env * (0.75 + 0.35 * np.abs(np.sin(t * 4.2 + phase)))
    bot = cy + h * 0.35 * env
    xs = cx + t * L / 2
    return list(zip(xs, top)) + list(zip(xs[::-1], bot[::-1]))


def paint(W=1920, H=1080, seed=1, colourway="Dusk", bleed=0.0, include=None, stages_dir=None, dense_stages=False):
    seed_all(seed)
    P = PAL[colourway]
    S = Scaler(W, H, bleed)
    s = S.s
    inc = set(GROUPS) if include is None else set(include)
    g = Panel(S, seed, ambient=0.08, sky=P['sky'])
    st = Stager(g, stages_dir, dense_stages)
    xx, yy = design_xy(g)
    X0, X1, Y0, Y1 = S.X0 - 30, S.X1 + 30, S.Y0 - 30, S.Y1 + 30

    # geometry every group may need (cheap masks, made whatever is included)
    near_m = g.poly(S.pts(ridge_pts(S, near_ridge)))
    far_m = g.poly(S.pts(ridge_pts(S, far_ridge)))
    pine_ms = [g.poly(S.pts(pine_outline(*p))) for p in PINES]
    pines_m = np.clip(sum(pine_ms), 0, 1)

    # ================================================================ sky: bands of pot-metal glass
    if 'sky' in inc:
        rng = g.group('sky')
        edges = [Y0, 115, 195, 272, 330, 385, 700]
        curve = lambda k: (lambda xs: np.full(len(xs), float(edges[k])) if k in (0, len(edges) - 1)
                           else edges[k] + 9 * np.sin(xs / 140.0 + 0.9 * k))
        for k, cols in enumerate(P['bands']):
            m = g.poly(S.pts(hband(S, curve(k), curve(k + 1))))
            if k in P['radial']:
                g.glass(m, cols, cell=58 * s, around=S.pt(*P['glow']), streak=0.5, flashed=cols[1] == '#b3182c')
            else:
                g.glass(m, cols, cell=78 * s, streak=0.6, aspect=1.6, angle=0.05)
            st('sky band %d' % k)
        if P['sun']:
            sx, sy, sr = P['sun']
            g.glass(g.circle(*S.pt(sx, sy), sr * s), ['#f2c230', '#f4d060'], streak=0.3)
            for k in range(16):
                a = k * np.pi / 8 + 0.2
                r0, r1 = sr + 10, sr + (34 if k % 2 else 22)
                g.trace(S.pts([(sx + r0 * np.cos(a), sy + r0 * np.sin(a)), (sx + r1 * np.cos(a), sy + r1 * np.sin(a))]),
                        3.0 * s, taper=(0.2, 0.9), smooth=False)
            g.trace(S.pts([(sx + (sr - 9) * np.cos(t), sy + (sr - 9) * np.sin(t)) for t in np.linspace(0, 2 * np.pi, 40)]),
                    1.6 * s, taper=(0.0, 0.0), wobble=0)
            g.stain(g.circle(*S.pt(sx, sy), (sr - 4) * s), 0.7)
            st('sun')
        g.matt(np.clip((150 - yy) / 150, 0, 1), 0.25, soft=20 * s)                 # the zenith deepens
        st('sky matt', major=True)

    # ================================================================ clouds: thin opal lenses
    if 'clouds' in inc:
        rng = g.group('clouds')
        for i, (cx, cy, L, h) in enumerate(CLOUDS):
            m = g.poly(S.pts(cloud_pts(cx, cy, L, h, phase=i * 1.7)))
            g.glass(m, P['cloud'], cell=max(L / 3.2, 60) * s, aspect=3.2, angle=0.0, streak=0.4, streak_dir=0.0,
                    seeds=0.4)
            if P['cloud_lit'] == 'below':      # dusk: lit from below, the top in shade
                g.shade(m, offset=(0, 7 * s), strength=0.5, soft=4 * s)
            else:
                g.shade(m, offset=(0, -6 * s), strength=0.38, soft=4 * s)
            for j in range(2):                 # scalloped grisaille lines inside the cloud
                xs = np.linspace(cx - L * (0.32 - 0.1 * j), cx + L * (0.3 - 0.08 * j), 14)
                ys = cy - h * (0.05 + 0.3 * j) - 3 * np.abs(np.sin((xs - cx) / 22.0 + j))
                g.trace(S.pts(list(zip(xs, ys))), 1.5 * s, taper=(0.4, 0.4), wobble=0.3 * s, clip=m)
            st('cloud %d' % i, major=i == len(CLOUDS) - 1)

    # ================================================================ far range
    if 'far' in inc:
        rng = g.group('far')
        g.glass(far_m, P['far'], cell=72 * s, streak=0.5, aspect=1.3, angle=-0.3)
        st('far glass')
        xs = np.linspace(S.X0, S.X1, 220)
        g.trace(S.pts(list(zip(xs, far_ridge(xs)))), 2.2 * s, taper=(0.02, 0.02), wobble=0.4 * s)
        for (x, y, dx, dy) in [(1250, 310, -60, 120), (1250, 310, 70, 110), (760, 352, -40, 90), (1700, 360, 40, 80)]:
            g.trace(S.pts([(x, y + 6), (x + dx * 0.5, y + dy * 0.45), (x + dx, y + dy)]), 1.8 * s, taper=(0.1, 0.8))
        st('far trace')
        g.shade(far_m, offset=(-26 * s, -8 * s), strength=0.35, soft=12 * s, clip=far_m * (xx > 1250))
        st('far shade', major=True)

    # ================================================================ near range, shore, pines
    if 'near' in inc:
        rng = g.group('near')
        g.glass(near_m, P['near'], cell=84 * s, streak=0.5, aspect=1.4, angle=0.2)
        st('near glass')
        xs = np.linspace(S.X0, S.X1, 220)
        g.trace(S.pts(list(zip(xs, near_ridge(xs)))), 2.6 * s, taper=(0.02, 0.02), wobble=0.4 * s, clip=1 - pines_m)
        for (x, y, dx, dy) in [(420, 460, -50, 100), (980, 556, 40, 60)]:
            g.trace(S.pts([(x, y + 6), (x + dx * 0.5, y + dy * 0.45), (x + dx, y + dy)]), 1.8 * s, taper=(0.1, 0.8))
        g.matt(near_m * np.clip((yy - near_ridge(xx)) / 140, 0, 1), 0.35, soft=6 * s)
        st('near trace')
        for (cx, top, hw, root), pm in zip(PINES, pine_ms):
            g.glass(pm, P['pines'], cell=30 * s, aspect=1.5, angle=np.pi / 2, streak=0.5, streak_dir=np.pi / 2)
            h = root - top
            tiers = 4 if h > 120 else 3
            for t in range(tiers):
                y_tip = top + h * 0.86 * (t + 1) / tiers
                w = hw * (t + 1) / tiers * 0.92
                xs_ = np.linspace(cx - w, cx + w, 12)
                ys_ = y_tip - 3 - 4 * np.abs(np.sin((xs_ - cx) / max(w, 1) * np.pi * 1.5))
                g.trace(S.pts(list(zip(xs_, ys_))), 1.8 * s, taper=(0.3, 0.3), wobble=0.3 * s)
            g.trace(S.pts([(cx, top + 10), (cx, top + h * 0.86)]), 1.6 * s, taper=(0.6, 0.1))
            g.shade(pm, offset=(10 * s, 0), strength=0.45, soft=3 * s)
            st('pine %d' % PINES.index((cx, top, hw, root)))
        st('near done', major=True)

    # ================================================================ water and every reflection
    if 'water' in inc:
        rng = g.group('water')
        wcurve = lambda y: (lambda xs: np.full(len(xs), float(y)) if y in (HORIZON, 1080)
                            else y + 7 * np.sin(xs / 90.0 + y))
        for (y0, y1), cols in zip(((HORIZON, 740), (740, 880), (880, 1080)), P['water']):
            bot = (lambda xs: np.full(len(xs), Y1)) if y1 == 1080 else wcurve(y1)
            m = g.poly(S.pts(hband(S, wcurve(y0), bot)))
            g.glass(m, cols, cell=70 * s, aspect=2.6, angle=0.0, streak=0.6, streak_dir=0.0)
            st('water band %d' % y0)
        nref = g.poly(S.pts(ridge_pts(S, near_ridge, flip=True, squash=0.8)))
        g.glass(nref, P['nref'], cell=70 * s, aspect=2.4, angle=0.0, streak_dir=0.0)
        st('range reflection')
        pref = np.clip(sum(g.poly(S.pts(pine_outline(*p, flip=True))) for p in PINES), 0, 1)
        g.glass(pref, P['pref'], cell=34 * s, aspect=2.0, angle=0.0, streak_dir=0.0)
        st('pine reflections')
        for k in range(9):
            y = 662 + k * 26 + rng.uniform(-4, 4)
            w = (95 - k * 8) * rng.uniform(0.8, 1.15)
            g.glass(g.ellipse(*S.pt(P['glit_x'] + rng.uniform(-12, 12), y), w * s, 7.5 * s), P['glit'][k % 2],
                    streak=0.3, streak_dir=0.0)
        st('glitter')
        water = (yy > HORIZON).astype(np.float32)
        g.matt(water * np.clip((yy - 700) / 380, 0, 1), 0.45, soft=10 * s)
        st('water matt')
        n_r = 34
        for k in range(n_r):                                                        # ripples lifted out of the matt
            y = 700 + (k / n_r) ** 1.2 * 360 + rng.uniform(-6, 6)
            x0 = rng.uniform(S.X0 + 40, S.X1 - 120)
            L = rng.uniform(60, 200) * (0.6 + (y - 640) / 440)
            if x0 + L > 1060 and x0 < 1280 and 760 < y < 850:
                continue
            g.scratch(S.pts([(x0, y), (x0 + L * 0.5, y + 1.5), (x0 + L, y)]), 2.2 * s)
            if k % 9 == 8:
                st('ripples %d' % k)
        st('water done', major=True)

    # ================================================================ mist: opalescent pale glass
    if 'mist' in inc:
        rng = g.group('mist')
        xs = np.linspace(X0, X1, 90)
        thick = 44 * (1 - 0.8 * np.clip(xs, 0, 1920) / 1920) + 8 * np.sin(xs / 85.0)
        top = 628 - thick * 0.55 + 6 * np.sin(xs / 51.0)
        bot = 650 + thick * 0.6 + 5 * np.sin(xs / 37.0 + 1)
        mist = g.poly(S.pts(list(zip(xs, top)) + list(zip(xs[::-1], bot[::-1]))))
        mist = mist * (1 - pines_m * (yy < 600))
        g.glass(mist, P['mist'], cell=64 * s, aspect=3.0, angle=0.0, streak=0.3, seeds=0.6)
        st('mist glass')
        g.stain(mist * np.clip((xx - 700) / 900, 0, 1) * 0.5, P['mist_stain'])      # the mist catches the sun
        st('mist stain', major=True)

    # ================================================================ boat, rower, reflection
    if 'boat' in inc:
        rng = g.group('boat')
        hull_pts = [(1072, 776), (1120, 784), (1170, 787), (1220, 784), (1266, 770), (1248, 797), (1200, 808),
                    (1130, 808), (1094, 798)]
        hull = g.poly(S.pts(hull_pts))
        g.glass(g.poly(S.pts([(1094, 812), (1246, 812), (1232, 836), (1110, 838)])), P['hull_ref'], streak=0.3)
        g.glass(hull, P['hull'], cell=60 * s, aspect=2.0, streak_dir=0.0)
        st('hull')
        body = g.poly(S.pts([(1152, 780), (1186, 780), (1182, 742), (1158, 742)]))
        g.glass(body, P['body'], streak=0.4)
        g.glass(g.circle(*S.pt(1170, 728), 13 * s), P['head'], streak=0.2)
        st('rower')
        g.trace(S.pts([(1072, 776), (1170, 787), (1266, 770)]), 3.2 * s, taper=(0.1, 0.1))
        g.trace(S.pts([(1092, 793), (1170, 799), (1250, 790)]), 1.6 * s, taper=(0.2, 0.2))
        g.trace(S.pts([(1160, 765), (1100, 826)]), 4.2 * s, taper=(0.1, 0.4), smooth=False)
        g.trace(S.pts([(1180, 765), (1242, 828)]), 4.2 * s, taper=(0.1, 0.4), smooth=False)
        g.trace(S.pts([(1158, 760), (1172, 770), (1184, 760)]), 2.0 * s)
        g.trace(S.pts([(1158, 724), (1166, 716), (1180, 720), (1182, 732)]), 3.0 * s)      # hair / cap
        g.matt(hull, 0.3, soft=2 * s)
        g.scratch(S.pts([(1100, 784), (1160, 790), (1230, 784)]), 2.0 * s)
        st('boat paint', major=True)

    # ================================================================ birds: gulls cut in dark glass
    if 'birds' in inc:
        rng = g.group('birds')
        for i, (bx, by, sc, fl) in enumerate(BIRDS):
            w_ = 40 * sc
            up = [(-w_, -0.45 * w_ * fl), (-0.55 * w_, -0.36 * w_), (-0.15 * w_, -0.1 * w_), (0, -0.02 * w_),
                  (0.15 * w_, -0.1 * w_), (0.55 * w_, -0.36 * w_), (w_, -0.45 * w_ * fl)]
            lo = [(0.55 * w_, -0.16 * w_), (0.16 * w_, 0.1 * w_), (0, 0.2 * w_), (-0.16 * w_, 0.1 * w_), (-0.55 * w_, -0.16 * w_)]
            g.glass(g.poly(S.pts([(bx + x, by + y) for x, y in up + lo])), P['bird'], streak=0.2, seeds=0.2)
            st('bird %d' % i, major=i == len(BIRDS) - 1)

    # ================================================================ reeds, lower left: painted blades
    if 'reeds' in inc:
        rng = g.group('reeds')
        for k in range(16):
            x = 18 + k * 18 + rng.uniform(-6, 6)
            top = 950 + rng.uniform(0, 60) + k * 3
            lean = rng.uniform(-30, 40)
            g.trace(S.pts([(x, Y1), (x + lean * 0.3, (1080 + top) / 2), (x + lean, top)]), 3.4 * s, taper=(0.0, 0.9))
            if k % 4 == 1:
                g.trace(S.pts([(x + lean, top - 2), (x + lean * 1.05, top - 22)]), 6.5 * s, taper=(0.4, 0.4))
            if k % 8 == 7:
                st('reeds %d' % k)
        st('reeds done', major=True)

    # ================================================================ finishing: lead, weather (always run)
    g.finish(lead=6.0, grime=0.35, pits=0.3)
    img = g.composite()
    st.save(img, 'final')
    return img


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else 'stainedglass_lake.png'
    W = int(sys.argv[2]) if len(sys.argv) > 2 else 1920
    H = int(sys.argv[3]) if len(sys.argv) > 3 else 1080
    cw = sys.argv[4] if len(sys.argv) > 4 else 'Dusk'
    bl = float(sys.argv[5]) if len(sys.argv) > 5 else 0.0
    t0 = time.perf_counter()
    im = paint(W, H, colourway=cw, bleed=bl)
    print('paint %.2fs' % (time.perf_counter() - t0))
    save_png(im, out)
