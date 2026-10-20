"""Mountain lake — Watercolour (水彩), painted with vendor lib/watercolor.py `Watercolor` and the
hand-made marks in _watercolour_kit.py.

Phase 2: bleed-aware, layer groups with per-group RNG, two colourways (Day / Dusk), dense draw-on stages.
Hand-made round 1: graphite underdrawing first; texture comes from each wash (granulation, flocculation,
dried edges, pooling, back-runs) instead of an overlay; every pine, cloud, bird, reed and water mark is
built individually; reflections are broken horizontal strokes; mist is lifted paper with ragged edges.

python scripts/scenes/watercolour_lake.py out.png [W H] [colourway] [bleed]
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np

import drawkit
from drawkit import Scaler, seed_all, save_png, group_rng
from watercolor import Watercolor, hexc
from core import blob_pts, spline, curve, fbm1d, blur, smoothstep
import _watercolour_kit as K

STYLE = "Watercolour · 水彩"
LIB = "watercolor"
COLOURWAYS = ("Day", "Dusk")
GROUPS = ("sky", "clouds", "far", "near", "water", "mist", "boat", "birds", "reeds")

Y0 = 640   # waterline (design px)

PAL = {
    "Dusk": dict(
        sky_top='#6f78a8', sky_bot='#c99bb0', sky_k=0.55, low='#f2a88c', low_k=0.5,
        glow='#f7cf8e', glow_k=0.35, glow_lift=0.45, sky_charge='#b88aa8',
        cloud='#8f82ad', cloud_k=0.36, cloud_under='#f0a990', cloud_under_k=0.32, cloud_lift=0.18,
        far='#a08fb8', far_lift=0.45, near='#4f6a84', near_shade='#33475a',
        pines=('#2c4a40', '#355544', '#2a4038'), pine_r='#3a5550', pine_sh='#1c2e33', shore='#3b3a3a',
        trunk='#4a3a2e', w_top='#f0b08f', w_top_k=0.45, w_deep='#46679a',
        r_far='#9a8fb5', r_near='#566a86', r_pine='#2c4a40', r_glow='#f7cf8e',
        mist=0.6, bird='#3a3550', bank='#6b6a3c', reeds=('#4f5a2c', '#6d6a34', '#3c4628'), cattail='#5a3a2a',
        hull='#8a5a3a', hull_in='#4a2e22', rower='#3e4a68', skin='#e5ae8a', hair='#3a2a2a', oar='#5a3e2a'),
    "Day": dict(
        sky_top='#4f86c6', sky_bot='#b7d3ea', sky_k=0.6, low='#f3e3c0', low_k=0.32,
        glow='#fff0c4', glow_k=0.18, glow_lift=0.25, sky_charge='#7fa6d4',
        cloud='#8d9bb8', cloud_k=0.22, cloud_under='#97a3bd', cloud_under_k=0.34, cloud_lift=0.85,
        far='#8a9cc4', far_lift=0.3, near='#4f7a72', near_shade='#2f4f50',
        pines=('#2a5a3e', '#346548', '#284a36'), pine_r='#386052', pine_sh='#16302a', shore='#4a4236',
        trunk='#5a4230', w_top='#cfe2ea', w_top_k=0.4, w_deep='#2f6ea8',
        r_far='#8fa0c4', r_near='#4f7a72', r_pine='#2a5a3e', r_glow='#fff0c4',
        mist=0.5, bird='#30384a', bank='#6f7d3a', reeds=('#4a6a2a', '#6f7f34', '#3a5226'), cattail='#6a4a2c',
        hull='#9a5a34', hull_in='#5a2e1e', rower='#b0423a', skin='#e9b48e', hair='#4a3426', oar='#5a3e2a'),
}


class Stager:
    """Snapshots in painting order: one per group normally, many with dense=True (NNN_name.png)."""
    def __init__(self, p, stages_dir, dense):
        self.p, self.dir, self.dense, self.n = p, stages_dir, dense, 0

    def __call__(self, name, major=False):
        if not self.dir or not (self.dense or major):
            return
        save_png(self.p.composite().convert('RGB'), os.path.join(self.dir, f"{self.n:03d}_{name.replace(' ', '_')}.png"))
        self.n += 1


def ridge_noise(seed, xs, scale_px=194, octaves=4):
    """1-D fractal noise as a function of DESIGN x, so the bleed only extends the ridge."""
    n = int(3920 / max(4, scale_px / 6)) + 2
    grid = np.linspace(-1000, 2920, n)
    v = fbm1d(n, scale_px / (grid[1] - grid[0]), octaves, seed)
    return np.interp(xs, grid, v)


def mountain(p, S, ridge, rng, soft_hard=1.6, soft_lost=12, lost=0.35, dry=0.4):
    """mask of a range under a ridge polyline (design px): a crisp dried edge in places, lost into the sky
    in others, and dry-brush breaks where the brush skipped over the tooth"""
    H, W = S.H, S.W
    poly = S.pts(ridge)
    base = K.polys([poly], H, W, ss=2, pad=int(S(soft_lost * 3)) + 4)
    a = base.a
    h, w = a.shape
    hard = K.on_box(K.soften(K.Crop(base.x0, base.y0, a.copy()), S(soft_hard), 0.45, rng, H, W), base)
    soft = smoothstep(0.05, 0.85, blur(a, S(soft_lost)) + (K.noise(rng, h, w, S(30), 3) - 0.5) * 0.3)
    mix = smoothstep(1 - lost - 0.15, 1 - lost + 0.15, K.noise(rng, h, w, S(140), 3))
    m = hard * (1 - mix) + soft * mix
    sl = base.sl
    patches = smoothstep(1 - dry - 0.1, 1 - dry + 0.1, K.noise(rng, h, w, S(90), 3))
    edge = np.clip(1 - np.abs(blur(a, S(3)) - 0.5) * 2, 0, 1)
    skip = smoothstep(0.3, 0.6, p.tooth[sl] + (blur(a, S(4)) - 0.5) * 1.2)
    m = m * (1 - patches * edge * (1 - skip))
    out = np.zeros((H, W), np.float32)
    out[sl] = m
    return out


def contour(P, nb=7):
    """left and right sketch contours of a polygon cloud (for the pencil)"""
    A = np.vstack(P)
    y0, y1 = A[:, 1].min(), A[:, 1].max()
    L, R = [], []
    for i in range(nb):
        a, b = y0 + (y1 - y0) * i / nb, y0 + (y1 - y0) * (i + 1) / nb
        sel = A[(A[:, 1] >= a) & (A[:, 1] <= b)]
        if len(sel):
            L.append((sel[:, 0].min(), (a + b) / 2)); R.append((sel[:, 0].max(), (a + b) / 2))
    return L, R


def paint(W=1920, H=1080, seed=1, colourway="Dusk", bleed=0.0, include=None,
          stages_dir=None, dense_stages=False):
    seed_all(seed)
    C = PAL[colourway]
    col = lambda k: hexc(C[k])
    inc = set(GROUPS) if include is None else set(include)
    S = Scaler(W, H, bleed)
    s = S.s
    p = Watercolor(S.W, S.H, seed=seed)
    CH, CW = S.H, S.W
    YY, XX = p.YY, p.XX
    XD, YD = (XX - S.ox) / s, (YY - S.oy) / s          # design-space coordinates of every pixel
    y0 = S.y(Y0)
    st = Stager(p, stages_dir, dense_stages)
    X0, X1 = S.X0, S.X1

    p.rng = group_rng(seed, 'paper')
    K.paper(p, s, p.rng)
    st('paper', True)

    # ================= geometry other groups need (reflections, pencil): computed whatever `include` is
    p.rng = group_rng(seed, 'geometry')
    g = p.rng
    glow = np.exp(-(((XD - 1240) / 330) ** 2 + ((YD - 560) / 200) ** 2)) * (YD < Y0)
    nx = int(240 * (X1 - X0) / 1920) + 2
    xs = np.linspace(X0, X1, nx)
    rough = ridge_noise(seed + 11, xs) + 0.25 * ridge_noise(seed + 12, xs, 30, 3)
    far_y = (370 - 70 * np.exp(-((xs - 1250) / 170) ** 2) - 45 * np.exp(-((xs - 560) / 240) ** 2)
             - 30 * np.exp(-((xs - 1700) / 200) ** 2) + 18 * rough + 30 * np.exp(-((xs - 900) / 150) ** 2))
    far_ridge = list(zip(xs, far_y))
    far_m = mountain(p, S, [(X0 - 20, Y0 + 4)] + far_ridge + [(X1 + 20, Y0 + 4)], g, soft_hard=2.0, soft_lost=14, lost=0.4, dry=0.3)
    rough2 = ridge_noise(seed + 21, xs) + 0.35 * ridge_noise(seed + 22, xs, 26, 3)
    near_y = (590 - 150 * np.exp(-((xs - 330) / 330) ** 2) - 90 * np.exp(-((xs - 820) / 220) ** 2)
              - 45 * np.exp(-((xs - 1700) / 200) ** 2) + 12 * rough2)
    near_ridge = list(zip(xs, near_y))
    near_m = mountain(p, S, [(X0 - 20, Y0 + 4)] + near_ridge + [(X1 + 20, Y0 + 4)], g, soft_hard=1.4, soft_lost=8, lost=0.25, dry=0.45)

    # pines: every tree built on its own (height, lean, tiers, fullness), left island then right island
    left = [(75, 470), (130, 430), (190, 500), (245, 420), (300, 475), (355, 520), (400, 455),
            (455, 540), (505, 560), (165, 545), (275, 555), (425, 585)]
    left = [(-150, 515), (-80, 480), (-20, 535)] + left          # only visible with bleed
    right = [(1500, 610), (1522, 572), (1548, 596), (1574, 548), (1603, 600), (1628, 566), (1660, 588),
             (1690, 556), (1722, 604), (1748, 578), (1786, 594), (1816, 615)]
    pines = []    # dict(x, root, h, m (Crop), P, trunk, side)
    for grp, lst in (('L', left), ('R', right)):
        for (x, top) in lst:
            jx = g.normal(0, 5)
            root = 652 + g.uniform(-3, 2) if grp == 'L' else 648 + g.uniform(-2, 2)
            h = (root - top) * g.uniform(0.9, 1.08)
            xc, rc = S.x(x + jx), S.y(root)
            if xc + S(h) * 0.3 < 0 or xc - S(h) * 0.3 > CW:
                continue
            P, trunk = K.pine(xc, rc, S(h), g, s, lean=g.normal(0, 0.035), sparse=g.uniform(0.0, 0.4),
                              width=g.uniform(0.8, 1.25) * (1.15 if grp == 'R' else 1.0))
            m = K.soften(K.polys(P, CH, CW, ss=2), S(1.1), 0.4, g, CH, CW)
            pines.append(dict(x=xc, root=rc, h=S(h), m=m, P=P, trunk=trunk, grp=grp))
    pines_L = sorted([q for q in pines if q['grp'] == 'L'], key=lambda q: q['x'])
    pines_R = sorted([q for q in pines if q['grp'] == 'R'], key=lambda q: q['x'])
    allp = K.union([q['m'] for q in pines], CH, CW)

    # boat
    CX, CY = S.x(1170), S.y(800)
    hull_pts = spline([(CX - S(93), CY - S(17)), (CX - S(70), CY - S(2)), (CX - S(30), CY + S(6)), (CX + S(40), CY + S(6)),
                       (CX + S(78), CY - S(4)), (CX + S(95), CY - S(19)), (CX + S(50), CY - S(10)), (CX - S(10), CY - S(8)),
                       (CX - S(60), CY - S(11)), (CX - S(93), CY - S(17))], 8)
    hull_pts = K.wobble_line(hull_pts, S(0.7), g, step=S(3), scale=8)

    # ================= pencil underdrawing: the whole composition, light and loose, before any paint
    def pen(name):
        return group_rng(seed, 'pencil ' + name)
    lines = []
    if 'far' in inc:
        r = pen('far')
        pts_ = S.pts(far_ridge)
        k0 = 0
        while k0 < len(pts_) - 3:                      # the ridge drawn in a few separate pulls
            k1 = min(len(pts_), k0 + int(r.integers(25, 70)))
            lines.append(pts_[max(0, k0 - 2):k1])
            k0 = k1
        K.pencil(p, lines, s, pen('far draw')); lines = []
    if 'near' in inc:
        r = pen('near')
        pts_ = S.pts(near_ridge)
        k0 = 0
        while k0 < len(pts_) - 3:
            k1 = min(len(pts_), k0 + int(r.integers(30, 80)))
            lines.append(pts_[max(0, k0 - 2):k1])
            k0 = k1
        K.pencil(p, lines, s, pen('near draw')); lines = []
    if 'water' in inc:
        r = pen('water')
        xa = X0
        while xa < X1:
            xb = xa + r.uniform(250, 700)
            yy_ = Y0 + r.normal(0, 1.5)
            lines.append(S.pts([(xa, yy_), (xb, yy_ + r.normal(0, 1.5))]))
            xa = xb + r.uniform(-20, 30)
        K.pencil(p, lines, s, pen('water draw')); lines = []
    st('pencil landscape')
    if 'near' in inc:
        r = pen('pines')
        for batch, name in ((pines_L, 'pencil pines'), (pines_R, 'pencil island')):
            lines = []
            for q in batch:
                L, R = contour(q['P'])
                tp = q['trunk'][-1]
                lines.append([tp] + L[1:]); lines.append([tp] + R[1:])
                lines.append([q['trunk'][0], q['trunk'][-1]])
            if batch is pines_L:
                lines.append(S.pts([(X0 - 20, 632), (200, 632), (540, 640), (600, 652)]))
            else:
                lines.append(S.pts([(1470, 651), (1500, 641), (1820, 640), (1850, 651)]))
            K.pencil(p, lines, s, r, k=0.5)
            st(name)
    else:
        st('pencil pines'); st('pencil island')
    lines = []
    if 'boat' in inc:
        r = pen('boat')
        lines.append(hull_pts)
        lines.append([(CX - S(2), CY - S(9)), (CX - S(7), CY - S(24)), (CX - S(12), CY - S(36))])
        lines.append([(CX - S(4), CY - S(11)), (CX - S(16), CY - S(17)), (CX - S(25), CY - S(14))])
        hd = blob_pts(CX - S(15), CY - S(46), S(6.5), S(7.5), rough=0.2, n=14, seed=seed + 4)
        lines.append(np.vstack([hd, hd[:2]]))
        lines.append([(CX - S(34), CY - S(30)), (CX + S(72), CY + S(22))])
        K.pencil(p, lines, s, pen('boat draw'), k=0.5); lines = []
    if 'reeds' in inc:
        r2 = pen('reeds')
        lines.append(S.pts([(X0 - 10, 1036), (120, 1030), (250, 1060)]))
        for _ in range(9):
            xb = r2.uniform(min(-10, X0 + 10), 280)
            ht = r2.uniform(90, 200)
            lines.append(S.pts([(xb, S.Y1 + 4), (xb + r2.normal(4, 6), S.Y1 - ht * 0.5), (xb + r2.normal(10, 10), S.Y1 - ht)]))
        K.pencil(p, lines, s, pen('reeds draw'), k=0.5)
    st('pencil boat and reeds', True)

    # ================= sky: wet-in-wet wash laid top-down, colour charged in, a dried tide line and back-runs
    if 'sky' in inc:
        p.rng = group_rng(seed, 'sky')
        r = p.rng
        bx = np.linspace(X0 - 40, X1 + 40, 60)
        by = 352 + 26 * ridge_noise(seed + 31, bx, 260, 3)
        bottom = np.interp(XD, bx, by)
        sky_m = np.clip((bottom + 40 - YD) / 80, 0, 1)
        t = np.clip(YD / 352 + (K.noise(r, CH, CW, S(260), 4) - 0.5) * 0.35, 0, 1)
        cfield = hexc(C['sky_top'])[None, None] * (1 - t[..., None]) + hexc(C['sky_bot'])[None, None] * t[..., None]
        charge = smoothstep(0.55, 0.85, K.noise(r, CH, CW, S(220), 3)) * 0.6
        cfield = cfield * (1 - charge[..., None]) + hexc(C['sky_charge']) * charge[..., None]
        box, T = K.wash(p, sky_m, cfield, C['sky_k'] * 1.05, s, r, edge=0.25, edge_px=6, gran=0.25, flocc=0.2,
                        var=0.3, var_px=150, pool=0.6, blooms=2, bloom_px=(45, 90), apply=False,
                        bloom_k=0.45, bloom_zone=((YD > 235) & (YD < 320)).astype(np.float32))
        yb = (np.arange(box.a.shape[0])[:, None] + box.y0 - S.oy) / s
        xb_ = (np.arange(box.a.shape[1])[None, :] + box.x0 - S.ox) / s
        # (the wash goes on in three passes from the top; the parts multiply up to the full wash)
        prev = np.zeros(box.a.shape, np.float32)
        for k_, fy in enumerate((120, 250, None)):
            if fy is None:
                cur = np.ones_like(prev)
            else:
                front = fy + 25 * ridge_noise(seed + 40 + k_, xb_, 150, 3)
                cur = np.maximum(prev, np.clip((front - yb) / 6, 0, 1))
            K.apply_T(p, box, T, cur - prev)
            prev = cur
            st(f'sky wash {k_ + 1}', False)
        low = np.clip((YD - 192) / 448, 0, 1) * (YD < Y0 + 4)
        K.wash(p, low, col('low'), C['low_k'], s, r, edge=0.0, gran=0.15, flocc=0.1, var=0.25, var_px=200)
        g2 = glow * (0.75 + 0.5 * K.noise(r, CH, CW, S(120), 3))
        K.lift(p, g2, C['glow_lift'], s, r, rough=0.2, rough_px=80)
        K.wash(p, g2, col('glow'), C['glow_k'], s, r, edge=0.0, gran=0.08, var=0.15)
        st('sky glow', True)

    # ================= clouds: each one different -- streaks, puffs, wisps; lost-and-found edges
    if 'clouds' in inc:
        p.rng = group_rng(seed, 'clouds')
        r = p.rng
        specs = [(330, 118, 520, 15, 6, 0.02, 0.2, 0.3, True), (880, 190, 360, 20, 4, -0.03, 0.7, 0.5, True),
                 (1230, 92, 600, 11, 7, 0.015, 0.1, 0.6, False), (1750, 150, 400, 17, 5, -0.02, 0.45, 0.35, True),
                 (-60, 232, 300, 13, 3, 0.0, 0.3, 0.5, True)]
        for i, (cx, cy, ln, th, lobes, tilt, puff, lost, hb) in enumerate(specs):
            if cx + ln < X0 - 50:
                continue
            m = K.cloud_shape(p, S, cx, cy, ln, th, r, lobes=lobes, tilt=tilt, puff=puff, lost=lost, hard_bottom=hb)
            if m is None:
                continue
            if C['cloud_lift'] > 0:
                K.lift(p, m, C['cloud_lift'], s, r, rough=0.4, rough_px=40)
            K.wash(p, m, [col('cloud'), col('cloud'), col('sky_top')], C['cloud_k'] * r.uniform(0.85, 1.15), s, r,
                   edge=0.5, edge_px=3, gran=0.35, var=0.4, var_px=50, blooms=int(r.integers(0, 2)), bloom_px=(14, 26),
                   charge_px=60)
            # warm under-colour dropped into part of the cloud while wet (not every cloud, not the whole length)
            if r.uniform() < 0.8:
                hgt = m.a.shape[0]
                yy_ = (np.arange(hgt)[:, None] + m.y0 - S.y(cy)) / S(th)
                xx_ = (np.arange(m.a.shape[1])[None, :] + m.x0 - S.x(cx)) / S(ln)
                side = np.clip(0.5 + (xx_ * r.choice([-1, 1]) + r.uniform(-0.2, 0.3)) * 1.5, 0, 1)
                under = K.Crop(m.x0, m.y0, m.a * np.clip(yy_ * 0.9 + 0.3, 0, 1) * side)
                K.wash(p, under, col('cloud_under'), C['cloud_under_k'] * r.uniform(0.6, 1.2), s, r, edge=0.15, gran=0.2, var=0.4)
            st(f'cloud {i + 1}', i == len(specs) - 1)

    # ================= far range
    if 'far' in inc:
        p.rng = group_rng(seed, 'far')
        r = p.rng
        K.wash(p, far_m, [col('far'), col('far'), col('r_far')], 0.52, s, r, edge=0.45, edge_px=4, gran=0.55, flocc=0.5,
               var=0.3, var_px=110, blooms=1, bloom_px=(40, 80))
        st('far glaze')
        haze = far_m * np.clip((YD - 470) / 170, 0, 1)
        K.lift(p, haze, C['far_lift'], s, r, rough=0.35, rough_px=60)
        st('far haze', True)

    # ================= near range + pines + shore
    if 'near' in inc:
        p.rng = group_rng(seed, 'near')
        r = p.rng
        box, T = K.wash(p, near_m, [col('near'), col('near'), col('near_shade'), col('far')], 0.8, s, r, edge=0.6,
                        edge_px=4, gran=0.45, flocc=0.4, var=0.3, var_px=100, apply=False)
        xb_ = (np.arange(box.a.shape[1])[None, :] + box.x0 - S.ox) / s
        yb = (np.arange(box.a.shape[0])[:, None] + box.y0 - S.oy) / s
        front = 820 + 60 * ridge_noise(seed + 51, yb, 80, 3)
        r1 = np.clip((front - xb_) / 8, 0, 1) * np.ones_like(box.a)
        K.apply_T(p, box, T, r1)
        st('near glaze 1')
        K.apply_T(p, box, T, 1 - r1)
        st('near glaze 2')
        shade = near_m * np.clip(1 - (XD - 200) / 800, 0, 1) * np.clip((YD - 470) / 160, 0, 1)
        K.wash(p, K.soften(K.crop_of(shade), S(10), 0.5, r, CH, CW), col('near_shade'), 0.45, s, r, edge=0.15, gran=0.35, var=0.35)
        st('near shade')
        # pines: one wet wash per island, revealed tree by tree (so overlaps merge like one wash),
        # then each tree's own shadow side and dark accents glazed on top once dry
        for batch, colours, chunks, nm in ((pines_L, [hexc(c_) for c_ in C['pines']], 5, 'pines'),
                                           (pines_R, [col('pine_r'), hexc(C['pines'][1]), col('near')], 2, 'island')):
            if not batch:
                continue
            U = K.union([q['m'] for q in batch], CH, CW)
            ubox, UT = K.wash(p, U, colours, 0.85, s, r, edge=0.7, edge_px=2.5, gran=0.4, flocc=0.4, var=0.35, var_px=40,
                              charge_px=45, apply=False)
            prev = np.zeros(ubox.a.shape, np.float32)
            n = len(batch)
            for ci in range(chunks):
                sub = batch[ci * n // chunks:(ci + 1) * n // chunks]
                if not sub:
                    continue
                for q in sub:
                    tr = K.ribbon(spline(q['trunk'], 4), max(S(2), q['h'] * 0.03), max(S(0.8), q['h'] * 0.008), r, wob=0.35, step=S(2))
                    K.wash(p, K.polys([tr], CH, CW), col('trunk'), 0.8, s, r, edge=0.4, edge_px=1.5, gran=0.3, var=0.3, var_px=20)
                cum = prev.copy()
                for q in sub:
                    cum = np.maximum(cum, K.on_box(q['m'], ubox))
                cur = np.clip(cum / np.maximum(ubox.a, 1e-3), 0, 1) * (ubox.a > 1e-3)
                cur = np.maximum(prev, cur)
                K.apply_T(p, ubox, UT, cur - prev)
                prev = cur
                for q in sub:
                    m = q['m']
                    hh, ww = m.a.shape
                    xx_ = np.arange(ww)[None, :] + m.x0
                    away = -1 if q['x'] < S.x(1240) else 1
                    side = np.clip(((xx_ - q['x']) * away) / (q['h'] * 0.12) + r.uniform(-0.3, 0.4), 0, 1)
                    shp = K.Crop(m.x0, m.y0, m.a * side * (0.4 + 0.8 * K.noise(r, hh, ww, S(8), 2)))
                    K.wash(p, K.soften(shp, S(1.5), 0.5, r, CH, CW), col('pine_sh'), r.uniform(0.35, 0.6), s, r, edge=0.4,
                           edge_px=1.5, gran=0.4, var=0.3, var_px=15)
                st(f'{nm} {ci + 1}', False)
            K.apply_T(p, ubox, UT, (ubox.a > 1e-3) * (1 - prev))
        shore = K.polys([S.pts([(X0 - 20, 653), (X0 - 20, 633), (0, 631), (120, 629), (200, 633), (330, 631), (440, 637),
                                (540, 641), (600, 653)]),
                         S.pts([(1468, 651), (1490, 644), (1540, 641), (1650, 639), (1760, 641), (1820, 640), (1852, 651)])], CH, CW)
        shore = K.soften(shore, S(2), 0.45, r, CH, CW)
        K.wash(p, shore, col('shore'), 0.7, s, r, edge=0.5, edge_px=2, gran=0.5, flocc=0.4, var=0.4, var_px=30)
        st('shore', True)

    # ================= water: horizon tint and depth laid in horizontal passes; reflections as broken strokes;
    # reserved/lifted paper in irregular clusters
    if 'water' in inc:
        p.rng = group_rng(seed, 'water')
        r = p.rng
        water = np.clip((YY - y0) / 3, 0, 1)
        K.wash(p, water * np.exp(-(YY - y0) / S(200)), col('w_top'), C['w_top_k'], s, r, edge=0.0, gran=0.15, var=0.2, var_px=160)
        st('water horizon')
        dm = water * np.clip(0.1 + (YY - y0) / S(440), 0, 1) ** 1.2
        box, T = K.wash(p, dm, [col('w_deep'), col('w_deep'), col('r_far')], 0.8, s, r, edge=0.0, gran=0.4, flocc=0.35,
                        var=0.25, var_px=140, apply=False)
        # horizontal brush passes: the density changes a little from pass to pass
        hh, ww = box.a.shape
        yb = np.arange(hh, dtype=np.float32)[:, None] + box.y0
        bands_ = np.zeros((hh, 1), np.float32)
        yy_ = float(y0)
        while yy_ < box.y0 + hh:
            bh = S(r.uniform(40, 90))
            bands_ += (r.uniform(-0.12, 0.12) * ((yb >= yy_) & (yb < yy_ + bh)))
            yy_ += bh
        bands_ = blur(np.repeat(bands_, 4, 1), S(3))[:, :1]
        K.apply_T(p, box, T, np.clip(1 + bands_ * np.ones((1, ww)), 0, 1.2))
        st('water depth')
        R = K.reflect(far_m * (YY < y0), y0, s, r, CH, CW, squash=0.85, band=(5, 12), gap=0.15, shift=2, fade=0.45, gate_px=140,
                      jit=0.08, vsoft=5)
        K.wash(p, R, col('r_far'), 0.38, s, r, edge=0.35, edge_px=2, gran=0.3, var=0.3)
        st('reflect far')
        R = K.reflect(near_m * (YY < y0), y0, s, r, CH, CW, squash=0.8, band=(4, 10), gap=0.2, shift=2, fade=0.5, gate_px=110,
                      jit=0.1, vsoft=4)
        K.wash(p, R, col('r_near'), 0.55, s, r, edge=0.4, edge_px=2, gran=0.35, var=0.3)
        st('reflect near')
        R = K.reflect(allp, y0 + S(8), s, r, CH, CW, squash=0.72, band=(2, 6), gap=0.35, shift=3, fade=0.6, gate_px=18,
                      jit=0.2, vsoft=1.5)
        K.wash(p, R, col('r_pine'), 0.6, s, r, edge=0.45, edge_px=1.5, gran=0.4, var=0.35, var_px=30)
        st('reflect pines')
        R = K.reflect(glow * (YY < y0), y0, s, r, CH, CW, squash=1.0, band=(2, 6), gap=0.45, shift=8, fade=0.5, gate_px=30)
        K.wash(p, R, col('r_glow'), 0.3, s, r, edge=0.0, gran=0.1)
        K.lift(p, R, 0.3, s, r, rough=0.3)
        st('reflect glow')

        def ctr(rr):
            f = rr.uniform(0, 1) ** 0.8
            return rr.uniform(X0 - 60, X1 - 80), Y0 + 12 + f * (S.Y1 - Y0 - 20), f
        nscale = (X1 - X0) / 1920 * (S.Y1 - Y0) / 440
        for b in range(2):
            marks = K.dash_clusters(r, int(14 * nscale), ctr, per=(2, 6), length=(80, 300), width=(2.2, 6), spread=(40, 7))
            m = K.polys(K.dash_polys(S, marks, r), CH, CW)
            m = K.soften(m, S(0.8), 0.5, r, CH, CW)
            dry = smoothstep(0.25, 0.6, p.tooth[m.sl] + (K.noise(r, *m.a.shape, S(40), 2) - 0.5) * 0.6)
            m.a = m.a * (0.45 + 0.55 * dry)
            K.lift(p, m, 0.85 if b == 0 else 0.6, s, r, rough=0.25, tooth=0.8)
            # broad scrubbed-out sheens (a damp flat brush dragged sideways), soft-edged and uneven
            marks = K.dash_clusters(r, int(4 * nscale), ctr, per=(1, 3), length=(220, 520), width=(7, 16), spread=(60, 10))
            m = K.soften(K.polys(K.dash_polys(S, marks, r, curl=0.1), CH, CW), S(4), 0.6, r, CH, CW)
            K.lift(p, m, 0.28, s, r, rough=0.5, rough_px=20, tooth=0.6)
            marks = K.dash_clusters(r, int(8 * nscale), ctr, per=(1, 4), length=(50, 180), width=(1.2, 3.2), spread=(30, 6))
            m = K.polys(K.dash_polys(S, marks, r), CH, CW)
            K.wash(p, K.soften(m, S(0.8), 0.4, r, CH, CW), col('w_deep'), 0.4, s, r, edge=0.5, edge_px=1.2, gran=0.3)
            st(f'water marks {b + 1}', b == 1)

    # ================= mist: paper lifted back with a damp brush/tissue in ragged veils, thicker on the left
    if 'mist' in inc:
        p.rng = group_rng(seed, 'mist')
        r = p.rng
        for k_ in range(2):
            veils = []
            xa = X0 - 200
            while xa < X1 + 100:
                ln = r.uniform(260, 620)
                cx = xa + ln / 2
                thick = r.uniform(12, 26) * (0.55 + 0.6 * np.clip(1 - cx / 1500, 0, 1))
                cy = 648 + r.normal(0, 9) + (8 if k_ else -4)
                veils.append(blob_pts(S.x(cx), S.y(cy), S(ln / 2), S(thick), rough=0.35, n=80, seed=int(r.integers(1 << 30)),
                                      rot=r.normal(0, 0.012)))
                xa += ln * r.uniform(0.45, 0.85)
            m = K.polys(veils, CH, CW, ss=1)
            m = K.soften(m, S(r.uniform(6, 10)), 0.6, r, CH, CW)
            hh, ww = m.a.shape
            xx_ = (np.arange(ww)[None, :] + m.x0 - S.ox) / s
            m.a = m.a * (0.4 + 0.6 * np.clip(1 - xx_ / 1500, 0, 1)) * (0.55 + 0.45 * K.noise(r, hh, ww, S(70), 3))
            K.lift(p, m, C['mist'] * (0.6 if k_ == 0 else 0.45), s, r, rough=0.3, rough_px=25, tooth=0.9)
            st(f'mist {k_ + 1}', k_ == 1)

    # ================= boat, rower, oar and the boat's own reflection
    if 'boat' in inc:
        p.rng = group_rng(seed, 'boat')
        r = p.rng
        hm = K.soften(K.polys([hull_pts], CH, CW, ss=3), S(0.8), 0.3, r, CH, CW)
        K.wash(p, hm, [col('hull'), col('hull'), col('hull_in')], 0.95, s, r, edge=0.6, edge_px=1.5, gran=0.35,
               var=0.35, var_px=20, charge_px=25)
        inner = K.polys([K.ribbon(spline([(CX - S(82), CY - S(14)), (CX - S(10), CY - S(9)), (CX + S(80), CY - S(15))], 6),
                                  S(3.5), S(2), r, wob=0.5, step=S(2))], CH, CW, ss=3)
        K.wash(p, inner, col('hull_in'), 0.6, s, r, edge=0.3, edge_px=1, gran=0.2)
        gun = K.polys([K.ribbon(spline([(CX - S(88), CY - S(15)), (CX - S(20), CY - S(6)), (CX + S(60), CY - S(7)),
                                        (CX + S(90), CY - S(17))], 6), S(1.8), S(1.2), r, wob=0.6, step=S(2))], CH, CW, ss=3)
        K.lift(p, gun, 0.55, s, r, rough=0.5, rough_px=6)
        st('hull')
        # rower: a hunched, leaning torso in one stroke, arms reaching to the oar, a head with a darker cap of hair
        torso = K.ribbon(spline([(CX - S(2), CY - S(8)), (CX - S(6), CY - S(22)), (CX - S(12), CY - S(34))], 6),
                         S(12), S(15.5), r, wob=0.25, step=S(1.2))
        knee = K.ribbon(spline([(CX - S(4), CY - S(11)), (CX - S(15), CY - S(17)), (CX - S(24), CY - S(14))], 5),
                        S(7), S(5), r, wob=0.3, step=S(1.2))
        arm = K.ribbon(spline([(CX - S(9), CY - S(33)), (CX - S(20), CY - S(29)), (CX - S(29), CY - S(30))], 6),
                       S(5.5), S(3.2), r, wob=0.3, step=S(1.0))
        body = K.soften(K.polys([torso, knee, arm], CH, CW, ss=3), S(0.8), 0.35, r, CH, CW)
        K.wash(p, body, [col('rower'), col('rower'), col('hull_in')], 0.9, s, r, edge=0.6, edge_px=1.5, gran=0.3,
               var=0.35, var_px=8, charge_px=10)
        neck = K.ribbon([(CX - S(12), CY - S(37)), (CX - S(14), CY - S(41))], S(4), S(3.5), r, wob=0.2, step=S(1))
        head = K.soften(K.polys([blob_pts(CX - S(15.5), CY - S(45), S(5.8), S(6.6), rough=0.2, n=30, seed=seed + 9, rot=0.4), neck],
                                CH, CW, ss=3), S(0.6), 0.3, r, CH, CW)
        K.wash(p, head, col('skin'), 0.8, s, r, edge=0.55, edge_px=1.0, gran=0.15, var=0.35, var_px=5)
        hat = [K.ribbon([(CX - S(23), CY - S(48.5)), (CX - S(15), CY - S(50)), (CX - S(7), CY - S(48))], S(2.6), S(2.0), r, wob=0.3, step=S(1)),
               blob_pts(CX - S(14.5), CY - S(53), S(5.2), S(3.6), rough=0.25, n=24, seed=seed + 10, rot=-0.1)]
        K.wash(p, K.soften(K.polys(hat, CH, CW, ss=3), S(0.5), 0.3, r, CH, CW), col('hair'), 0.85, s, r, edge=0.4, edge_px=1,
               gran=0.2, var=0.3, var_px=5)
        st('rower')
        oar = K.ribbon(spline([(CX - S(31), CY - S(31)), (CX + S(10), CY - S(14)), (CX + S(45), CY + S(4)), (CX + S(72), CY + S(21))], 6),
                       S(2.6), S(2.0), r, wob=0.4, step=S(1.5))
        blade = K.ribbon(spline([(CX + S(52), CY + S(9)), (CX + S(64), CY + S(16)), (CX + S(76), CY + S(23))], 4),
                         S(3), S(5.5), r, wob=0.35, step=S(1.2))
        K.wash(p, K.soften(K.polys([oar, blade], CH, CW, ss=3), S(0.6), 0.3, r, CH, CW), col('oar'), 0.85, s, r,
               edge=0.5, edge_px=1, gran=0.25, var=0.3, var_px=10)
        st('oar')
        boat_m = K.union([hm, body, head], CH, CW)
        R = K.reflect(boat_m, CY + S(6), s, r, CH, CW, squash=0.7, band=(1.5, 4), gap=0.3, shift=2.5, fade=0.5, gate_px=12)
        K.wash(p, R, col('hull_in'), 0.45, s, r, edge=0.4, edge_px=1, gran=0.3, var=0.3, var_px=10)
        marks = [(1070 + r.uniform(-10, 10), 808 + r.uniform(-1, 1), r.uniform(110, 160), r.uniform(2, 3)),
                 (1150 + r.uniform(-10, 30), 811, r.uniform(80, 140), r.uniform(1.5, 2.5)),
                 (1230 + r.uniform(-10, 10), 807, r.uniform(40, 90), r.uniform(1.5, 2.5))]
        K.lift(p, K.soften(K.polys(K.dash_polys(S, marks, r), CH, CW), S(0.7), 0.4, r, CH, CW), 0.55, s, r, rough=0.3)
        st('boat reflection', True)

    # ================= birds: each its own span, wing angle and weight
    if 'birds' in inc:
        p.rng = group_rng(seed, 'birds')
        r = p.rng
        birds = [(1380, 250, 1.0), (1440, 222, 0.8), (1505, 262, 0.7), (1590, 205, 0.9), (1665, 242, 0.6)]
        for i, (bx, by, sc) in enumerate(birds):
            K.bird(p, S, bx, by, sc, col('bird'), r)
            if i in (2, len(birds) - 1):
                st(f'birds {1 if i == 2 else 2}', i == len(birds) - 1)

    # ================= foreground reeds, lower-left: tapered blades of varied weight, a few cattails
    if 'reeds' in inc:
        p.rng = group_rng(seed, 'reeds')
        r = p.rng
        bank = K.polys([S.pts([(X0 - 20, S.Y1 + 20), (X0 - 20, 1036), (0, 1040), (60, 1033), (120, 1030), (190, 1046),
                               (250, 1060), (290, S.Y1 + 20)])], CH, CW)
        K.wash(p, K.soften(bank, S(4), 0.45, r, CH, CW), col('bank'), 0.5, s, r, edge=0.5, edge_px=2.5, gran=0.5, var=0.4, var_px=30)
        st('bank')
        xa = min(-10, X0 + 10)
        n = int(60 * (300 - xa) / 310)
        batches = 3
        for b in range(batches):
            P, heads = [], []
            for _ in range(n // batches):
                xd = 300 - (300 - xa) * r.uniform(0, 1) ** 1.3
                x = S.x(xd); yb = S.y(S.Y1 + 4)
                h = S(r.uniform(60, 200) * (1.1 - max(xd, 0) / 400) + (S.Y1 - 1080))
                lean = r.normal(S(8), S(14)) * (1.4 if r.uniform() < 0.2 else 1)
                c = spline([(x, yb), (x + lean * 0.25, yb - h * 0.5), (x + lean, yb - h)], 8)
                w0 = S(r.uniform(2.5, 8.0)) * (0.6 + 0.4 * (b + 1) / batches)
                P.append(K.ribbon(c, w0, S(r.uniform(0.3, 1.2)), r, wob=0.25, step=S(2)))
                if r.uniform() < 0.07 and h > S(110):
                    hx, hy = c[-1]
                    heads.append(blob_pts(hx - lean * 0.06, hy + S(14), S(r.uniform(3, 4.5)), S(r.uniform(11, 16)), rough=0.15,
                                          n=24, seed=int(r.integers(1 << 30)), rot=float(np.arctan2(lean, h))))
            m = K.soften(K.polys(P, CH, CW, ss=2), S(0.7), 0.35, r, CH, CW)
            K.wash(p, m, [hexc(c_) for c_ in C['reeds']], 0.72 + 0.06 * b, s, r, edge=0.6, edge_px=1.5, gran=0.4, var=0.35,
                   var_px=25, charge_px=40)
            if heads:
                K.wash(p, K.polys(heads, CH, CW, ss=3), col('cattail'), 0.85, s, r, edge=0.5, edge_px=1.2, gran=0.4)
            st(f'reeds {b + 1}')

    # ================= finishing (watercolour has no overlay pass; keep the seed contract anyway)
    p.rng = group_rng(seed, 'finish')
    img = p.composite().convert('RGB')
    st('final', True)
    return img


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else 'watercolour_lake.png'
    W = int(sys.argv[2]) if len(sys.argv) > 2 else 1920
    H = int(sys.argv[3]) if len(sys.argv) > 3 else 1080
    cw = sys.argv[4] if len(sys.argv) > 4 else 'Dusk'
    bl = float(sys.argv[5]) if len(sys.argv) > 5 else 0.0
    save_png(paint(W, H, colourway=cw, bleed=bl), out)
    print('saved', out)
