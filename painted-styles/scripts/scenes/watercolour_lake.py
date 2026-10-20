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

    # reeds: blade centre lines computed up front (the pencil follows them); own generator, so painting
    # or skipping any other group never changes them
    gr = group_rng(seed, 'reeds geometry')
    reeds_geo = []          # (centre line, base width, height, lean, batch, broken-at)
    xa_r = min(-10, X0 + 10)
    n_r = int(64 * (300 - xa_r) / 310)
    for i in range(n_r):
        xd = 300 - (300 - xa_r) * gr.uniform(0, 1) ** 1.3
        x = S.x(xd)
        yb = S.y(S.Y1 + 4) - S(gr.uniform(0, 26)) * np.clip(1 - (xd - 120) / 200, 0, 1)
        hgt = S(gr.uniform(50, 210) * (1.1 - max(xd, 0) / 420) + (S.Y1 - 1080))
        lean = gr.normal(S(8), S(16)) * (1.5 if gr.uniform() < 0.2 else 1)
        cv = spline([(x, yb), (x + lean * gr.uniform(0.1, 0.35), yb - hgt * 0.5), (x + lean, yb - hgt)], 10)
        w0 = S(gr.uniform(2.0, 11.0)) * (1.0 if gr.uniform() < 0.8 else 1.5)
        brk = gr.uniform(0.45, 0.8) if gr.uniform() < 0.12 else None
        reeds_geo.append((cv, w0, hgt, lean, i % 3, brk))

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
                # trunk and a few branch gestures, all inside the tree's own silhouette (no outline round it)
                tr = np.asarray(q['trunk'], np.float32)
                cut = int(r.integers(0, 3))
                lines.append(tr[cut:len(tr) - int(r.integers(0, 2))])
                L, R = contour(q['P'], 9)
                for (lx, ly), (rx_, ry_) in zip(L[2:], R[2:]):
                    if r.uniform() < 0.4:
                        continue
                    xt = float(np.interp(ly, tr[::-1, 1], tr[::-1, 0]))
                    for ex_ in ((lx,) if r.uniform() < 0.5 else (rx_,)):
                        f_ = r.uniform(0.35, 0.6)
                        lines.append([(xt, ly - q['h'] * 0.01), (xt + (ex_ - xt) * f_, ly + q['h'] * 0.015)])
            if batch is pines_L:
                lines.append(S.pts([(X0 - 20, 640), (200, 640), (540, 645), (600, 650)]))
            else:
                lines.append(S.pts([(1480, 649), (1520, 645), (1820, 645), (1845, 650)]))
            K.pencil(p, lines, s, r, k=0.45)
            st(name)
    else:
        st('pencil pines'); st('pencil island')
    lines = []
    if 'boat' in inc:
        r = pen('boat')
        lines.append(hull_pts[::2])
        lines.append([(CX - S(3), CY - S(9)), (CX - S(7), CY - S(24)), (CX - S(11), CY - S(34))])
        lines.append([(CX - S(5), CY - S(11)), (CX - S(16), CY - S(16))])
        hd = blob_pts(CX - S(15), CY - S(45), S(4.5), S(5), rough=0.2, n=10, seed=seed + 4)
        lines.append(np.vstack([hd, hd[:2]]))
        lines.append([(CX - S(28), CY - S(29)), (CX + S(64), CY + S(18))])
        K.pencil(p, lines, s, pen('boat draw'), k=0.4); lines = []
    if 'reeds' in inc:
        r2 = pen('reeds')
        for (c_, w0_, h_, *_rest) in reeds_geo[::4]:
            if r2.uniform() < 0.6:
                lines.append(c_[:max(3, int(len(c_) * r2.uniform(0.5, 0.9)))])
        K.pencil(p, lines, s, pen('reeds draw'), k=0.4)
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
                        var=0.42, var_px=110, pool=0.6, blooms=2, bloom_px=(45, 85), apply=False,
                        bloom_k=0.5, bloom_zone=((YD > 150) & (YD < 320)).astype(np.float32), charge_px=90)
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
        st('sky glow')
        # where one pass dried before the next met it: long broken tide lines, and two cauliflower back-runs
        K.tideline(p, S, X0 + r.uniform(60, 300), r.uniform(1000, 1350), 122 + r.uniform(-8, 8), 16, col('sky_charge'), r, k=0.07)
        K.tideline(p, S, r.uniform(700, 1000), X1 - r.uniform(0, 200), 252 + r.uniform(-8, 8), 13, col('sky_top'), r, k=0.06)
        for (bx_, by_, rx_) in ((r.uniform(180, 420), r.uniform(235, 270), r.uniform(45, 70)),
                                (r.uniform(1480, 1760), r.uniform(70, 130), r.uniform(55, 85))):
            K.backrun(p, S, bx_, by_, rx_, rx_ * r.uniform(0.5, 0.75), col('sky_top'), r, k=0.07, lift_amt=0.05, edge=1.6)
        st('sky blooms', True)

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
                    # trunk: only the lower part, a broken stroke -- it shows in the gaps, not as a skewer
                    trk = q['trunk'][:int(len(q['trunk']) * r.uniform(0.45, 0.75))]
                    tr = K.ribbon(spline(trk, 4), max(S(1.6), q['h'] * 0.026), max(S(0.7), q['h'] * 0.01), r, wob=0.5, step=S(2))
                    trm = K.drybrush(K.soften(K.polys([tr], CH, CW), S(0.6), 0.5, r, CH, CW), p, r, s, dry=0.3, scale=8)
                    K.wash(p, trm, col('trunk'), 0.6, s, r, edge=0.4, edge_px=1.2, gran=0.3, var=0.4, var_px=10)
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

        def ctr(rr):
            f = rr.uniform(0, 1) ** 0.8
            return rr.uniform(X0 - 60, X1 - 80), Y0 + 12 + f * (S.Y1 - Y0 - 20), f
        nscale = (X1 - X0) / 1920 * (S.Y1 - Y0) / 440
        # paper reserved for the light on the water before any paint goes on: few, broken, soft-edged, in the
        # paper's own colour (the washes go round them and dry with an edge against them)
        marks = K.dash_clusters(r, int(6 * nscale), ctr, per=(1, 4), length=(40, 230), width=(2.5, 7), spread=(45, 6))
        glint = K.soften(K.polys(K.dash_polys(S, marks, r, curl=0.4), CH, CW), S(1.8), 0.85, r, CH, CW)
        glint = K.drybrush(glint, p, r, s, dry=0.4, scale=18)
        glint.a = glint.a * (0.55 + 0.45 * K.noise(r, *glint.a.shape, S(30), 2))
        K.wash(p, water * np.exp(-(YY - y0) / S(200)), col('w_top'), C['w_top_k'], s, r, edge=0.0, gran=0.15, var=0.2, var_px=160,
               hold=glint)
        st('water horizon')
        dm = water * np.clip(0.1 + (YY - y0) / S(440), 0, 1) ** 1.2
        box, T = K.wash(p, dm, [col('w_deep'), col('w_deep'), col('r_far')], 0.8, s, r, edge=0.0, gran=0.3, flocc=0.3,
                        var=0.25, var_px=140, apply=False, hold=glint)
        T = np.maximum(T, (K.on_box(glint, box) * 0.9)[..., None])
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
        K.wash(p, R, col('r_far'), 0.38, s, r, edge=0.35, edge_px=2, gran=0.3, var=0.3, hold=glint)
        st('reflect far')
        R = K.reflect(near_m * (YY < y0), y0, s, r, CH, CW, squash=0.8, band=(4, 10), gap=0.2, shift=2, fade=0.5, gate_px=110,
                      jit=0.1, vsoft=4)
        K.wash(p, R, col('r_near'), 0.55, s, r, edge=0.4, edge_px=2, gran=0.35, var=0.3, hold=glint)
        st('reflect near')
        R = K.reflect(allp, y0 + S(8), s, r, CH, CW, squash=0.72, band=(2, 6), gap=0.35, shift=3, fade=0.6, gate_px=18,
                      jit=0.2, vsoft=1.5)
        K.wash(p, R, col('r_pine'), 0.6, s, r, edge=0.45, edge_px=1.5, gran=0.4, var=0.35, var_px=30, hold=glint)
        st('reflect pines')
        R = K.reflect(glow * (YY < y0), y0, s, r, CH, CW, squash=1.0, band=(2, 6), gap=0.45, shift=8, fade=0.5, gate_px=30)
        K.wash(p, R, col('r_glow'), 0.3, s, r, edge=0.0, gran=0.1)
        K.lift(p, R, 0.3, s, r, rough=0.3)
        st('reflect glow')

        for b in range(2):
            # broad scrubbed-out sheens (a damp flat brush dragged sideways), soft-edged and uneven
            marks = K.dash_clusters(r, int(4 * nscale), ctr, per=(1, 3), length=(220, 520), width=(7, 16), spread=(60, 10))
            m = K.soften(K.polys(K.dash_polys(S, marks, r, curl=0.1), CH, CW), S(4), 0.6, r, CH, CW)
            K.lift(p, m, 0.25, s, r, rough=0.5, rough_px=20, tooth=0.6)
            # a few small blotted lights, broken by the tooth -- never crisp white strokes
            marks = K.dash_clusters(r, int(4 * nscale), ctr, per=(1, 3), length=(30, 120), width=(2, 4.5), spread=(30, 5))
            m = K.soften(K.polys(K.dash_polys(S, marks, r, curl=0.4), CH, CW), S(1.5), 0.8, r, CH, CW)
            K.lift(p, K.drybrush(m, p, r, s, dry=0.55, scale=14), 0.45, s, r, rough=0.45, rough_px=8, tooth=0.8)
            marks = K.dash_clusters(r, int(8 * nscale), ctr, per=(1, 4), length=(50, 180), width=(1.2, 3.6), spread=(30, 6))
            m = K.polys(K.dash_polys(S, marks, r), CH, CW)
            K.wash(p, K.soften(m, S(0.9), 0.5, r, CH, CW), col('w_deep'), 0.4, s, r, edge=0.5, edge_px=1.2, gran=0.3, hold=glint)
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
        hm = K.soften(K.polys([hull_pts], CH, CW, ss=3), S(0.9), 0.5, r, CH, CW)
        # hull: a warm first stroke laid quickly, its wet lower edge bleeding into the damp water
        K.wash(p, K.bleed(hm, S(7), r, CH, CW, amt=0.5), [col('hull'), col('hull'), col('oar')], 0.75, s, r, edge=0.7, edge_px=1.4,
               gran=0.4, var=0.5, var_px=12, charge_px=14, pool=0.8)
        # then the dark keel dropped in along the bottom while it was still wet: soft inside, running below
        keel = K.polys([K.ribbon(spline([(CX - S(80), CY - S(9)), (CX - S(30), CY + S(3)), (CX + S(35), CY + S(3)),
                                         (CX + S(82), CY - S(9))], 8), S(4), S(6), r, wob=0.7, peak=0.45, step=S(2), ends=0.3)],
                       CH, CW, ss=2)
        keel = K.soften(keel, S(2.2), 0.7, r, CH, CW)
        keel.a = keel.a * K.on_box(K.bleed(hm, S(2), r, CH, CW, amt=0.9), keel)
        K.wash(p, K.bleed(keel, S(10), r, CH, CW, amt=0.45), [col('hull_in'), col('hull_in'), col('w_deep')], 0.8, s, r, edge=0.6,
               edge_px=1.2, gran=0.45, var=0.5, var_px=8, charge_px=10, pool=0.8)
        inner = K.polys([K.ribbon(spline([(CX - S(82), CY - S(14)), (CX - S(10), CY - S(9)), (CX + S(80), CY - S(15))], 6),
                                  S(4.5), S(2), r, wob=0.7, step=S(2))], CH, CW, ss=2)
        K.wash(p, K.soften(inner, S(1.2), 0.6, r, CH, CW), col('hull_in'), 0.55, s, r, edge=0.5, edge_px=1, gran=0.3, var=0.5, var_px=6)
        # the gunwale: a line of paper left between the strokes, broken where the brushes touched
        gun = K.polys([K.ribbon(spline([(CX - S(88), CY - S(15)), (CX - S(20), CY - S(6)), (CX + S(60), CY - S(7)),
                                        (CX + S(90), CY - S(17))], 6), S(2.2), S(1.2), r, wob=0.7, step=S(2))], CH, CW, ss=2)
        gun.a = gun.a * smoothstep(0.35, 0.6, K.noise(r, *gun.a.shape, S(14), 2))
        K.lift(p, K.drybrush(K.soften(gun, S(0.7), 0.6, r, CH, CW), p, r, s, dry=0.5, scale=6), 0.5, s, r, rough=0.5, rough_px=5)
        st('hull')
        # rower: the hunched body in one loaded stroke that runs into the wet hull, arms a second flick,
        # the head a single dab with the cap dropped into it while wet (no outline anywhere)
        torso = K.ribbon(spline([(CX - S(1), CY - S(6)), (CX - S(6), CY - S(22)), (CX - S(12), CY - S(34))], 6),
                         S(13), S(15), r, wob=0.5, peak=0.6, step=S(1.2), ends=0.5)
        knee = K.ribbon(spline([(CX - S(4), CY - S(11)), (CX - S(15), CY - S(17)), (CX - S(25), CY - S(13))], 5),
                        S(7.5), S(4), r, wob=0.5, step=S(1.2))
        arm = K.ribbon(spline([(CX - S(9), CY - S(33)), (CX - S(19), CY - S(28)), (CX - S(29), CY - S(30))], 6),
                       S(6), S(2.5), r, wob=0.5, step=S(1.0))
        body = K.soften(K.polys([torso, knee, arm], CH, CW, ss=2), S(1.1), 0.7, r, CH, CW)
        K.wash(p, K.bleed(body, S(4), r, CH, CW, amt=0.4), [col('rower'), col('rower'), col('hull_in'), col('w_deep')], 0.85, s, r,
               edge=0.7, edge_px=1.3, gran=0.35, var=0.55, var_px=6, charge_px=7, pool=0.9)
        head = K.soften(K.polys([blob_pts(CX - S(15.5), CY - S(44.5), S(5.6), S(6.4), rough=0.3, n=24, seed=seed + 9, rot=0.4),
                                 K.ribbon([(CX - S(12), CY - S(37)), (CX - S(14), CY - S(41))], S(4.5), S(3.5), r, wob=0.3, step=S(1))],
                                CH, CW, ss=2), S(0.9), 0.6, r, CH, CW)
        K.wash(p, head, [col('skin'), col('skin'), col('hull')], 0.7, s, r, edge=0.4, edge_px=1.0, gran=0.15, var=0.5, var_px=4, charge_px=4)
        hat = K.soften(K.polys([blob_pts(CX - S(15), CY - S(51), S(6.5), S(3.6), rough=0.35, n=20, seed=seed + 10, rot=-0.15)], CH, CW, ss=2),
                       S(1.0), 0.7, r, CH, CW)
        K.wash(p, K.bleed(hat, S(3), r, CH, CW, amt=0.5), col('hair'), 0.8, s, r, edge=0.5, edge_px=1, gran=0.25, var=0.45, var_px=4)
        st('rower')
        # oar: one quick, slightly bowed pull of a small brush -- it starves and breaks along its length,
        # and the blade is a single dab whose wet edge runs into the water
        oc = spline([(CX - S(31), CY - S(31)), (CX + S(8), CY - S(15) + S(r.normal(0, 1.5))), (CX + S(45), CY + S(2) + S(r.normal(0, 1.5))),
                     (CX + S(70), CY + S(19))], 8)
        oc = K.wobble_line(oc, S(0.9), r, step=S(2.5), scale=6)
        oar = K.soften(K.polys([K.ribbon(oc, S(3.2), S(1.6), r, wob=0.6, step=S(1.5))], CH, CW, ss=2), S(0.7), 0.6, r, CH, CW)
        oar.a = oar.a * (0.35 + 0.65 * smoothstep(0.3, 0.55, K.noise(r, *oar.a.shape, S(10), 2)))
        oar = K.drybrush(oar, p, r, s, dry=0.4, scale=8)
        blade = K.soften(K.polys([K.ribbon(spline([(CX + S(52), CY + S(9)), (CX + S(64), CY + S(16)), (CX + S(76), CY + S(22))], 4),
                                           S(3), S(6.5), r, wob=0.6, peak=0.7, step=S(1.2), ends=0.4)], CH, CW, ss=2), S(1.2), 0.7, r, CH, CW)
        blade = K.bleed(blade, S(5), r, CH, CW, amt=0.45)
        K.wash(p, K.union([oar, blade], CH, CW), [col('oar'), col('oar'), col('hull_in')], 0.8, s, r,
               edge=0.6, edge_px=1, gran=0.3, var=0.45, var_px=6, charge_px=8)
        st('oar')
        boat_m = K.union([hm, body, head], CH, CW)
        R = K.reflect(boat_m, CY + S(6), s, r, CH, CW, squash=0.7, band=(1.5, 4.5), gap=0.35, shift=3, fade=0.55, gate_px=12, vsoft=1.5)
        K.wash(p, R, [col('hull_in'), col('hull_in'), col('rower')], 0.42, s, r, edge=0.5, edge_px=1, gran=0.3, var=0.45, var_px=8,
               charge_px=10)
        marks = [(1070 + r.uniform(-10, 10), 808 + r.uniform(-1, 1), r.uniform(110, 160), r.uniform(2, 3)),
                 (1150 + r.uniform(-10, 30), 811, r.uniform(80, 140), r.uniform(1.5, 2.5)),
                 (1230 + r.uniform(-10, 10), 807, r.uniform(40, 90), r.uniform(1.5, 2.5))]
        wake = K.soften(K.polys(K.dash_polys(S, marks, r, curl=0.4), CH, CW), S(1.4), 0.8, r, CH, CW)
        K.lift(p, K.drybrush(wake, p, r, s, dry=0.45, scale=10), 0.45, s, r, rough=0.45, rough_px=6)
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
        # the bank: a few quick, overlapping dabs of a loaded brush, not one shape -- gaps of paper between
        # them, hard where they dried, dragged dry along the top
        dabs = []
        xb_ = X0 - 40
        while xb_ < 270:
            ln_ = r.uniform(50, 150)
            taper = 0.35 + 0.65 * np.clip((300 - xb_) / 260, 0, 1)
            yc_ = 1050 + 22 * np.clip((xb_ - 100) / 200, 0, 1) + r.normal(0, 8)
            dabs.append(blob_pts(S.x(xb_ + ln_ / 2), S.y(yc_ + 20), S(ln_ / 2), S(r.uniform(18, 36) * taper), rough=0.4, n=60,
                                 seed=int(r.integers(1 << 30)), rot=r.normal(-0.05, 0.08)))
            xb_ += ln_ * r.uniform(0.55, 1.05)
        bank = K.soften(K.polys(dabs, CH, CW, ss=1), S(2.0), 0.8, r, CH, CW)
        bank = K.drybrush(bank, p, r, s, dry=0.35, scale=25)
        K.wash(p, bank, [col('bank'), col('bank'), hexc(C['reeds'][2]), col('bank')], 0.5, s, r, edge=0.8, edge_px=2.5, gran=0.6,
               flocc=0.5, var=0.5, var_px=25, charge_px=30, pool=0.8)
        dk = K.Crop(bank.x0, bank.y0, bank.a * smoothstep(0.45, 0.7, K.noise(r, *bank.a.shape, S(40), 3)))
        K.wash(p, K.soften(dk, S(3), 0.6, r, CH, CW), hexc(C['reeds'][2]), 0.45, s, r, edge=0.6, edge_px=1.5, gran=0.5, var=0.4)
        st('bank')
        # blades: tapered, bellied low, each its own weight; some bent over; cattails as ragged loaded dabs
        for b in range(3):
            P, heads, tips = [], [], []
            for (cv, w0, hgt, lean, bt, brk) in reeds_geo:
                if bt != b:
                    continue
                c = np.asarray(cv, np.float32).copy()
                if brk is not None:                       # the blade folds over and hangs
                    j0 = int(len(c) * brk)
                    piv = c[j0]
                    ang = r.choice([-1, 1]) * r.uniform(1.8, 2.6)
                    ca, sa = np.cos(ang), np.sin(ang)
                    d_ = (c[j0:] - piv) * r.uniform(0.5, 0.8)
                    c[j0:] = piv + np.stack([d_[:, 0] * ca - d_[:, 1] * sa, d_[:, 0] * sa + d_[:, 1] * ca], 1)
                    c = spline(c[::2], 4)
                w1 = S(r.uniform(0.2, 1.0))
                P.append(K.ribbon(c, w0 * r.uniform(0.6, 0.9), w1, r, wob=0.35, peak=r.uniform(0.08, 0.35), step=S(2), ends=0.55))
                if brk is None and r.uniform() < 0.08 and hgt > S(110):
                    hx, hy = c[-1]
                    ang_ = float(np.arctan2(lean, hgt))
                    hc = (hx - lean * 0.08, hy + S(r.uniform(14, 22)))
                    hl, hw_ = S(r.uniform(11, 18)), S(r.uniform(3, 4.8))
                    heads.append(blob_pts(hc[0], hc[1], hw_, hl, rough=0.3, n=30, seed=int(r.integers(1 << 30)), rot=ang_))
                    for _ in range(int(r.integers(2, 5))):            # ragged, fluffing bits
                        o = r.uniform(-1, 1)
                        heads.append(blob_pts(hc[0] + hw_ * r.normal(0, 0.7), hc[1] + hl * o * 0.9, hw_ * r.uniform(0.3, 0.6),
                                              hw_ * r.uniform(0.4, 0.9), rough=0.5, n=14, seed=int(r.integers(1 << 30))))
                    tips.append(K.ribbon([(hx, hy + S(2)), (hx + lean * 0.02, hy - S(r.uniform(6, 14)))], S(1.4), S(0.3), r, wob=0.3,
                                         step=S(1)))
            m = K.soften(K.polys(P, CH, CW, ss=2), S(0.8), 0.5, r, CH, CW)
            K.wash(p, m, [hexc(c_) for c_ in C['reeds']], (0.8, 0.9, 1.0)[b], s, r, edge=0.3, edge_px=0.9, gran=0.45, var=0.4,
                   var_px=18, charge_px=25, pool=0.4)
            if heads:
                hm_ = K.soften(K.polys(heads, CH, CW, ss=2), S(1.0), 0.8, r, CH, CW)
                hm_ = K.drybrush(hm_, p, r, s, dry=0.25, scale=5)
                K.wash(p, hm_, [col('cattail'), col('cattail'), hexc(C['reeds'][2])], 0.85, s, r, edge=0.6, edge_px=1.0, gran=0.55,
                       var=0.5, var_px=4, charge_px=5)
                K.wash(p, K.polys(tips, CH, CW, ss=2), hexc(C['reeds'][2]), 0.7, s, r, edge=0.3, edge_px=0.8, gran=0.2)
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
