"""Coastal village on a cliff with a lighthouse, sailing boats and gulls — Watercolour (水彩),
painted with vendor lib/watercolor.py `Watercolor` and the hand-made marks in _watercolour_kit.py. Scene B (still).

Hand-made round 1: wet-in-wet sky with back-runs; clouds, houses, windows, boulders, bushes, sails and gulls
are each built individually with wobble; reflections are broken horizontal strokes; wave marks and glitter
are clustered, irregular reserved/lifted paper.

python scripts/scenes/watercolour_coast.py out.png [W H] [colourway] [bleed]
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from PIL import Image, ImageDraw

import drawkit
from drawkit import Scaler, seed_all, save_png, group_rng
from watercolor import Watercolor, hexc
from core import blob_pts, spline, curve, fbm1d, smoothstep, blur
import _watercolour_kit as K

STYLE = "Watercolour · 水彩"
LIB = "watercolor"
COLOURWAYS = ("Day", "Dusk")
GROUPS = ("all",)

HZ = 560   # sea horizon (design px)

PAL = {
    "Dusk": dict(
        sky_top='#6c72a8', sky_bot='#d39aa6', sky_k=0.55, low='#f3ac86', low_k=0.5, glow='#f8cf88', glow_k=0.4,
        sky_charge='#b88aa8',
        sun=(520, 532), sun_lift=0.85, cloud='#8a7fad', cloud_k=0.36, cloud_under='#f2a284', cloud_lift=0.1,
        far='#9a8ab4', sea_top='#f1b291', sea_deep='#465f98', wave='#3c4f86', glitter='#f8d08a',
        rock='#c2968a', rock_sh='#6a5a80', flank='#f2b48e', rock_dk='#3f3a55', grass='#6f7d55', grass_dk='#3f5148',
        wall='#f0d6bf', wall_sh='#8f7f9e', roofs=('#b25a45', '#c06a48', '#9a4a42'), roof_sh='#7a3a3c',
        win='#ffd27a', win_dk='#5a4a6a', win_lit=0.75,
        tower_sh='#9c8fae', band='#b03c34', lamp='#ffe08a', iron='#3a3440', bush='#3d5246', sail='#f6e2cf', sail_sh='#9d8cae',
        hull='#3b3448', gull='#3e3850'),
    "Day": dict(
        sky_top='#4a86c9', sky_bot='#c3dcef', sky_k=0.6, low='#f4e6c6', low_k=0.25, glow='#fff3cc', glow_k=0.15,
        sky_charge='#7fa6d4',
        sun=(300, -60), sun_lift=0.0, cloud='#8f9cbb', cloud_k=0.22, cloud_under='#97a3bd', cloud_lift=0.85,
        far='#8ea3c4', sea_top='#bfe0e4', sea_deep='#1f6f9e', wave='#1d5a86', glitter='#fff6d8',
        rock='#d6b88c', rock_sh='#8a8090', flank='#f5dcae', rock_dk='#5a524c', grass='#7fa04e', grass_dk='#3f6a3c',
        wall='#f6efe2', wall_sh='#a3aebe', roofs=('#c4583a', '#d0703e', '#a8483a'), roof_sh='#8a3a2c',
        win='#3e5068', win_dk='#2e3a4e', win_lit=0.0,
        tower_sh='#a8b2c4', band='#c23a30', lamp='#cfe2ea', iron='#3a3440', bush='#3c6a40', sail='#fbf7ee', sail_sh='#9fb0c8',
        hull='#2f4a6a', gull='#4a4f5c'),
}


class Stager:
    def __init__(self, p, stages_dir, dense):
        self.p, self.dir, self.dense, self.n = p, stages_dir, dense, 0

    def __call__(self, name, major=False):
        if not self.dir or not (self.dense or major):
            return
        save_png(self.p.composite().convert('RGB'), os.path.join(self.dir, f"{self.n:03d}_{name.replace(' ', '_')}.png"))
        self.n += 1


def ridge_noise(seed, xs, scale_px=194, octaves=4):
    n = 160
    grid = np.linspace(-1000, 2920, n)
    return np.interp(xs, grid, fbm1d(n, scale_px / (grid[1] - grid[0]), octaves, seed))


def poly_union(H, W, polys, ss=2):
    im = Image.new('L', (W * ss, H * ss), 0)
    d = ImageDraw.Draw(im)
    for pts in polys:
        d.polygon([(float(x) * ss, float(y) * ss) for x, y in pts], fill=255)
    return np.asarray(im.resize((W, H), Image.BILINEAR), np.float32) / 255


def jit(pts, r, sd):
    """hand-placed corners: every vertex off by a little"""
    return [(x + r.normal(0, sd), y + r.normal(0, sd)) for x, y in pts]


def bowed(a, b, bow, r, n=6):
    """a slightly bowed, hand-drawn edge from a to b (design px)"""
    (xa, ya), (xb, yb) = a, b
    dx, dy = xb - xa, yb - ya
    L = np.hypot(dx, dy) + 1e-6
    nx, ny = -dy / L, dx / L
    t = np.linspace(0, 1, n)
    off = 4 * t * (1 - t) * bow + r.normal(0, 0.25, n) * (t > 0) * (t < 1)
    return [(xa + dx * u + nx * o, ya + dy * u + ny * o) for u, o in zip(t, off)]


def paint(W=1920, H=1080, seed=1, colourway="Dusk", bleed=0.0, include=None,
          stages_dir=None, dense_stages=False):
    seed_all(seed)
    C = PAL[colourway]
    col = lambda k: hexc(C[k])
    S = Scaler(W, H, bleed)
    s = S.s
    p = Watercolor(S.W, S.H, seed=seed)
    CH, CW = S.H, S.W
    YY, XX = p.YY, p.XX
    XD, YD = (XX - S.ox) / s, (YY - S.oy) / s
    X0, X1, Y1 = S.X0, S.X1, S.Y1
    st = Stager(p, stages_dir, dense_stages)
    dusk = colourway == 'Dusk'
    pts = lambda seq: S.pts(seq)
    if include is not None and 'all' not in include:
        p.rng = group_rng(seed, 'paper'); K.paper(p, s, p.rng)
        p.rng = group_rng(seed, 'finish')
        return p.composite().convert('RGB')

    p.rng = group_rng(seed, 'paper')
    K.paper(p, s, p.rng)
    st('paper', True)
    p.rng = group_rng(seed, 'all')
    r = p.rng

    # ---------------- geometry: the headland's top edge (design px) as a function of x
    def top_edge(x):
        x = np.asarray(x, np.float32)
        base = np.interp(x, [880, 905, 935, 965, 1010, 1120, 1250, 1400, 1560, 1720, 1900, 2600],
                         [712, 610, 528, 485, 473, 468, 452, 438, 424, 416, 408, 395])
        return base + 4 * ridge_noise(seed + 5, x, 90, 3)

    def base_line(x):
        x = np.asarray(x, np.float32)
        return (712 + 6 * np.sin(x / 83) + 14 * ridge_noise(seed + 13, x, 140, 3) + 5 * ridge_noise(seed + 14, x, 22, 2)
                - 10 * np.exp(-((x - 1350) / 90) ** 2) + 8 * np.exp(-((x - 1700) / 60) ** 2))

    ex = np.linspace(880, X1 + 30, 160)
    ey = top_edge(ex)
    bx = np.linspace(X1 + 30, 860, 90)
    land_pts = [(860, float(base_line(860)))] + list(zip(ex, ey)) + [(X1 + 30, float(base_line(X1 + 30)))] + list(zip(bx, base_line(bx)))
    land = p.shape(pts(land_pts), soft=S(2.5), ragged=0.25)
    keep = 1 - smoothstep(0.55, 0.95, land)   # the sea and low sky stop under the cliff (no paper gap at its edge)

    # ---------------- pencil: horizon, headland, lighthouse, roofs and boats sketched loosely first
    pr = group_rng(seed, 'pencil')
    lines = [pts([(X0, HZ + pr.normal(0, 1)), (880, HZ + pr.normal(0, 1))]), pts(list(zip(ex[::4], ey[::4])))]
    lines.append(pts([(990 - 25, float(top_edge(990)) + 6), (990 - 17, 262), (990 + 17, 262), (990 + 25, float(top_edge(990)) + 6)]))
    for (bx_, by_, L_) in ((760, 600, 46), (250, 650, 80), (560, 870, 165)):
        lines.append(pts([(bx_ - L_ * 0.5, by_ - L_ * 0.07), (bx_ + L_ * 0.55, by_ - L_ * 0.09)]))
        lines.append(pts([(bx_, by_ - L_ * 0.05), (bx_, by_ - L_ * 1.15), (bx_ - L_ * 0.46, by_ - L_ * 0.14)]))
    K.pencil(p, lines, s, pr)

    # ---------------- cloud shapes first: on a fair day they are paper the sky wash was painted round
    clouds = [(240, 150, 460, 14, 6, 0.02, 0.2, 0.35), (780, 95, 380, 18, 4, -0.03, 0.6, 0.5), (1250, 170, 520, 12, 7, 0.015, 0.15, 0.55),
              (1700, 110, 400, 20, 5, -0.02, 0.5, 0.3), (-80, 300, 300, 11, 3, 0.0, 0.3, 0.5), (2020, 250, 340, 15, 4, 0.02, 0.4, 0.4)]
    cms = []
    for (cx, cy, ln, th, lobes, tilt, puff, lost) in clouds:
        if cx + ln < X0 - 50 or cx - ln > X1 + 50:
            continue
        if not dusk:
            th, puff = th * 1.8, puff + 0.4
        m = K.cloud_shape(p, S, cx, cy, ln, th, r, lobes=lobes, tilt=tilt, puff=puff, lost=lost if dusk else lost * 0.45,
                          hard_bottom=dusk or r.uniform() < 0.5)
        if m is not None:
            cms.append((m, cx, cy, ln, th))
    hold = None
    if not dusk and cms:
        hold = K.union([m for m, *_ in cms], CH, CW)
        hold.a = np.clip(hold.a * 1.15, 0, 0.97)

    # ---------------- sky: wet-in-wet, colour charged in, back-runs low down
    K.sky(p, S, r, YD, HZ - 60, col('sky_top'), col('sky_bot'), C['sky_k'] * 1.05, charge=col('sky_charge'), seed=seed + 31, hold=hold,
          var=0.42, bloom_k=0.5)
    low = np.clip((YD - 200) / 360, 0, 1) * (YD < HZ + 3) * keep
    K.wash(p, low, col('low'), C['low_k'], s, r, edge=0.0, gran=0.15, flocc=0.1, var=0.25, var_px=200, hold=hold)
    sx, sy = C['sun']
    glow = np.exp(-(((XD - sx) / 420) ** 2 + ((YD - sy) / 230) ** 2)) * (YD < HZ + 2)
    g2 = glow * (0.75 + 0.5 * K.noise(r, CH, CW, S(120), 3))
    K.lift(p, g2, 0.4, s, r, rough=0.2, rough_px=80)
    K.wash(p, g2, col('glow'), C['glow_k'], s, r, edge=0.0, gran=0.08, var=0.15)
    if C['sun_lift'] > 0:     # a lifted sun disk sitting on the horizon, blotted with a tissue
        sun = K.polys([pts(blob_pts(sx, sy, 40, 39, rough=0.08, n=60, seed=seed + 3))], CH, CW)
        sun = K.soften(sun, S(2.5), 0.35, r, CH, CW)
        sun.a = sun.a * (YD[sun.sl] < HZ)
        K.lift(p, sun, C['sun_lift'], s, r, rough=0.3, rough_px=12, tooth=0.6)
    K.tideline(p, S, X0 + r.uniform(0, 200), r.uniform(700, 1000), 205 + r.uniform(-10, 10), 14, col('sky_top'), r, k=0.06, hold=hold)
    K.backrun(p, S, r.uniform(1350, 1550), r.uniform(240, 300), r.uniform(45, 70), r.uniform(25, 40), col('sky_top'), r, k=0.07,
              lift_amt=0.05, edge=1.6, hold=hold)
    st('sky', True)

    # clouds: Day -- only the shadowed undersides go in, on the reserved paper; Dusk -- darker cloud washes on the sky
    for (m, cx, cy, ln, th) in cms:
        if C['cloud_lift'] > 0 and dusk:
            K.lift(p, m, C['cloud_lift'], s, r, rough=0.4, rough_px=40)
        hgt, wid = m.a.shape
        yy_ = (np.arange(hgt)[:, None] + m.y0 - S.y(cy)) / S(th)
        if dusk:
            K.wash(p, m, [col('cloud'), col('cloud'), col('sky_top')], C['cloud_k'] * r.uniform(0.85, 1.15), s, r, edge=0.5,
                   edge_px=3, gran=0.35, var=0.4, var_px=50, blooms=int(r.integers(0, 2)), bloom_px=(14, 26), charge_px=60)
        else:
            rows_ = np.flatnonzero(m.a.max(1) > 0.3)
            fr_ = (np.arange(hgt, dtype=np.float32)[:, None] - rows_[0]) / max(1, rows_[-1] - rows_[0])
            under = K.Crop(m.x0, m.y0, m.a * smoothstep(0.3, 0.95, fr_ + (K.noise(r, hgt, wid, S(30), 3) - 0.5) * 0.7))
            K.wash(p, K.soften(under, S(r.uniform(2, 6)), 0.7, r, CH, CW), [col('cloud'), col('cloud'), col('sky_top')],
                   C['cloud_k'] * r.uniform(1.9, 2.6), s, r, edge=0.7, edge_px=2, gran=0.3, var=0.5, var_px=30,
                   blooms=int(r.integers(0, 2)), bloom_px=(10, 20), charge_px=40)
        if r.uniform() < 0.8:
            xx_ = (np.arange(wid)[None, :] + m.x0 - S.x(cx)) / S(ln)
            side = np.clip(0.5 + (xx_ * r.choice([-1, 1]) + r.uniform(-0.2, 0.3)) * 1.5, 0, 1)
            K.wash(p, K.Crop(m.x0, m.y0, m.a * np.clip(yy_ * 0.9 + 0.3, 0, 1) * side), col('cloud_under'), 0.3 * r.uniform(0.6, 1.2),
                   s, r, edge=0.15, gran=0.2, var=0.4)
    st('clouds', True)

    # ---------------- far headland on the left horizon, pale
    xs = np.linspace(X0 - 20, 640, 120)
    fy = HZ + 2 - np.clip(60 * np.exp(-((xs - 120) / 260) ** 2) + 30 * np.exp(-((xs - 380) / 120) ** 2)
                          + 8 * ridge_noise(seed + 9, xs) + 2.5 * ridge_noise(seed + 10, xs, 25, 3), 0, None) * np.clip((600 - xs) / 140, 0, 1)
    far_m = K.soften(K.polys([pts([(X0 - 20, HZ + 4)] + list(zip(xs, fy)) + [(640, HZ + 4)])], CH, CW), S(2.5), 0.45, r, CH, CW)
    K.wash(p, far_m, [col('far'), col('far'), col('sky_top')], 0.55, s, r, edge=0.5, edge_px=3, gran=0.5, flocc=0.4, var=0.3)
    haze = K.Crop(far_m.x0, far_m.y0, far_m.a * np.clip((YD[far_m.sl] - (HZ - 40)) / 50, 0, 1))
    K.lift(p, haze, 0.35, s, r, rough=0.35, rough_px=40)
    st('far headland', True)

    # ---------------- sea: horizon tint, deepening toward us, reflections as strokes, clustered wave marks
    sea = np.clip((YD - HZ) * s / 2, 0, 1) * keep

    def ctr(rr):
        f = rr.uniform(0, 1) ** 1.2
        return rr.uniform(X0 - 40, X1), HZ + 8 + f * (Y1 - HZ - 8), f
    nsc = (X1 - X0) / 1920 * (Y1 - HZ) / 520
    # light on the water: paper kept back from the sea washes -- few, broken, soft-edged
    if dusk:
        def gctr(rr):
            f = rr.uniform(0, 1) ** 1.5
            return sx + rr.normal(0, 18 + 150 * f), HZ + 4 + f * (Y1 - HZ - 4), f
    else:
        def gctr(rr):
            f = rr.uniform(0, 1) ** 1.5
            return rr.uniform(200, 1400) + 300 * f, HZ + 4 + f * (Y1 - HZ - 4), f
    marks = K.dash_clusters(r, int(9 * (Y1 - HZ) / 520), gctr, per=(1, 4), length=(20, 110), width=(2, 5.5), spread=(22, 5))
    marks += K.dash_clusters(r, int(5 * nsc), ctr, per=(1, 3), length=(40, 200), width=(2.5, 6), spread=(40, 6))
    glint = K.soften(K.polys(K.dash_polys(S, marks, r, curl=0.4), CH, CW), S(1.8), 0.85, r, CH, CW)
    glint = K.drybrush(glint, p, r, s, dry=0.4, scale=16)
    glint.a = glint.a * sea[glint.sl] * (0.5 + 0.5 * K.noise(r, *glint.a.shape, S(30), 2))
    K.wash(p, sea * np.exp(-(YD - HZ) / 170), col('sea_top'), 0.5, s, r, edge=0.0, gran=0.15, var=0.2, var_px=160, hold=glint)
    K.wash(p, sea * np.clip(0.18 + (YD - HZ) / 420, 0, 1) ** 1.1, [col('sea_deep'), col('sea_deep'), col('wave')], 0.8, s, r,
           edge=0.0, gran=0.3, flocc=0.45, var=0.32, var_px=140, hold=glint)
    K.lift(p, np.exp(-((YD - HZ - 3) / 3) ** 2) * keep * (0.6 + 0.4 * K.noise(r, CH, CW, S(60), 2)), 0.35, s, r, rough=0.3)
    R = K.reflect(far_m.full(CH, CW) * (YY < S.y(HZ)), S.y(HZ), s, r, CH, CW, squash=0.8, band=(3, 7), gap=0.3, shift=3, fade=0.5,
                  gate_px=60, jit=0.15, vsoft=2)
    K.wash(p, R, col('far'), 0.32, s, r, edge=0.35, edge_px=1.5, gran=0.3, var=0.3)
    R = K.reflect(glow * (YY < S.y(HZ)), S.y(HZ), s, r, CH, CW, squash=1.0, band=(2, 6), gap=0.45, shift=8, fade=0.5, gate_px=30)
    if R is not None:
        R.a = R.a * keep[R.sl]
        K.wash(p, R, col('glow'), 0.35, s, r, edge=0.0, gran=0.1)

    marks = K.dash_clusters(r, int(26 * nsc), ctr, per=(2, 6), length=(40, 200), width=(1.2, 5.5), spread=(40, 8))
    wm = K.polys(K.dash_polys(S, marks, r), CH, CW)
    wm = K.soften(wm, S(0.8), 0.45, r, CH, CW)
    wm.a = wm.a * sea[wm.sl]
    K.wash(p, wm, [col('wave'), col('wave'), col('sea_deep')], 0.42, s, r, edge=0.55, edge_px=1.2, gran=0.35, var=0.35, var_px=30,
           hold=glint)
    marks = K.dash_clusters(r, int(8 * nsc), ctr, per=(1, 4), length=(50, 220), width=(3, 9), spread=(40, 8))
    lm = K.soften(K.polys(K.dash_polys(S, marks, r, curl=0.2), CH, CW), S(3), 0.7, r, CH, CW)
    lm.a = lm.a * sea[lm.sl]
    K.lift(p, K.drybrush(lm, p, r, s, dry=0.5, scale=20), 0.35, s, r, rough=0.45, rough_px=12, tooth=0.8)
    if dusk:     # the glitter path: a damp brush pulled down under the sun
        col_m = sea * np.exp(-((XD - sx) / (25 + 0.35 * (YD - HZ))) ** 2)
        K.lift(p, K.soften(K.crop_of(col_m), S(6), 0.6, r, CH, CW), 0.3, s, r, rough=0.45, rough_px=20)
        K.wash(p, glint, col('glitter'), 0.3, s, r, edge=0.0, gran=0.0)
    st('sea', True)

    # ---------------- the headland: rock face, fissures, strata, grass cap
    # the first wash is carried down into the damp sea: the foot of the cliff runs out in fingers, no cut edge
    landc = K.crop_of(land)
    landb = K.bleed(landc, S(16), r, CH, CW, amt=0.55)
    K.wash(p, landb, [col('rock'), col('rock'), col('flank'), col('rock_sh')], 0.62, s, r, edge=0.55, edge_px=3, gran=0.5, flocc=0.4,
           var=0.4, var_px=90, charge_px=140, pool=0.7, blooms=2, bloom_px=(25, 50), bloom_k=0.5)
    # patchy second pigment (cooler) so the face is not one flat colour
    patch = K.Crop(landc.x0, landc.y0, landc.a * smoothstep(0.45, 0.7, K.noise(r, *landc.a.shape, S(110), 4)))
    K.wash(p, K.soften(patch, S(5), 0.6, r, CH, CW), col('rock_sh'), 0.3, s, r, edge=0.4, edge_px=2.5, gran=0.45, var=0.4, hold=None)
    st('rock wash')
    tops = top_edge(np.clip(XD, 880, 4000))
    bl = base_line(np.clip(XD, 860, 4000))
    # face darkens toward the sea, plus a shadow band under the grass lip
    depth = land * np.clip((YD - tops - 20) / 220, 0, 1) ** 1.3
    K.wash(p, depth, [col('rock_sh'), col('rock_sh'), col('rock_dk')], 0.45, s, r, edge=0.0, gran=0.45, var=0.4, var_px=60)
    lip = K.crop_of(land * np.exp(-((YD - tops - 26) / 12) ** 2) * (XD > 960))
    K.wash(p, K.soften(lip, S(3), 0.7, r, CH, CW), col('rock_sh'), 0.42, s, r, edge=0.5, edge_px=2, gran=0.4, var=0.45)
    # the seaward flank catches the low light
    flank = K.crop_of(land * np.clip((1015 - XD) / 70, 0, 1))
    if flank is not None:
        flank = K.soften(flank, S(5), 0.6, r, CH, CW)
        K.lift(p, flank, 0.3, s, r, rough=0.4, rough_px=20)
        K.wash(p, flank, col('flank'), 0.35, s, r, edge=0.2, gran=0.3, var=0.4)
    # fissures: dry-brush drags in clumps -- some a hair, some a broad scumble, leaning with the rock
    batches = ([], [], [])
    xk = 975.0
    while xk < X1 - 5:
        xk += r.uniform(15, 140) if r.uniform() < 0.6 else r.uniform(120, 260)
        for _ in range(int(r.integers(1, 6))):
            fx = xk + r.normal(0, 14)
            ty = float(top_edge(min(fx, X1))) + r.uniform(25, 110)
            ln = r.uniform(25, 170) * r.uniform(0.5, 1.0)
            lim = float(base_line(min(fx, X1))) - 6 - ty
            ln = min(ln, lim)
            if ln < 15:
                continue
            ang = r.normal(0.05, 0.12)
            kind = int(r.choice(3, p=[0.55, 0.3, 0.15]))
            wd = (r.uniform(1.6, 3.4), r.uniform(3.5, 6.5), r.uniform(8, 18))[kind]
            c_ = spline([(fx, ty), (fx + ln * ang * 0.5 + r.normal(0, 3), ty + ln * 0.5), (fx + ln * ang + r.normal(0, 5), ty + ln)], 6)
            batches[kind].append(K.ribbon(pts(c_), S(wd * r.uniform(0.6, 1.2)), S(wd * r.uniform(0.2, 0.6)), r, wob=0.5,
                                          peak=r.uniform(0.2, 0.5), step=max(0.8, S(3)), ends=0.3))
    # strata: dry horizontal drags following the slope, broken
    for k in range(int(r.integers(4, 8))):
        xa = r.uniform(970, X1 - 60)
        yy = float(top_edge(xa)) + r.uniform(45, 220)
        ln = r.uniform(30, 200)
        if yy > float(base_line(xa)) - 15:
            continue
        batches[int(r.integers(1, 3))].append(K.ribbon(pts(spline([(xa, yy), (xa + ln * 0.5, yy - ln * 0.02 + r.normal(0, 3)),
                                                                   (xa + ln, yy - ln * 0.035 + r.normal(0, 3))], 6)),
                                                   S(r.uniform(3, 7)), S(r.uniform(1, 2.5)), r, wob=0.6, peak=r.uniform(0.2, 0.6),
                                                   step=max(0.8, S(3)), ends=0.2))
    for kind, P_ in enumerate(batches):
        if not P_:
            continue
        m_ = K.soften(K.polys(P_, CH, CW), S((0.6, 0.9, 2.0)[kind]), 0.6, r, CH, CW)
        m_ = K.drybrush(m_, p, r, s, dry=(0.35, 0.5, 0.7)[kind], scale=(10, 16, 25)[kind])
        m_.a = m_.a * land[m_.sl]
        K.wash(p, m_, [col('rock_dk'), col('rock_sh'), col('rock_dk')], (0.6, 0.48, 0.36)[kind], s, r, edge=0.5, edge_px=1.2,
               gran=0.4, var=0.5, var_px=15, charge_px=20)
    st('cliff face')
    # base: wet dark rock band run into the sea, clustered boulders of every size, broken foam
    base_band = K.crop_of(land * np.clip((YD - (bl - 45 + 15 * K.noise(r, CH, CW, S(40), 2))) / 30, 0, 1))
    base_band = K.bleed(K.soften(base_band, S(5), 0.6, r, CH, CW), S(12), r, CH, CW, amt=0.5)
    K.wash(p, base_band, [col('rock_dk'), col('rock_dk'), col('rock_sh'), col('wave')], 0.45, s, r, edge=0.6, edge_px=2, gran=0.5,
           var=0.45, var_px=30, charge_px=40, pool=0.7)
    rocks, lit = [], []
    xr = 870.0
    while xr < X1 + 20:
        xr += r.uniform(40, 190)
        nb_ = int(r.integers(1, 6))
        for j in range(nb_):
            rx = r.uniform(5, 30) * (1.0 if j == 0 else r.uniform(0.35, 0.8))
            ry = rx * r.uniform(0.45, 0.85)
            x = xr + r.normal(0, 22)
            yb = float(base_line(min(max(x, 880), X1 + 20))) + r.uniform(-3, 10)
            bp = blob_pts(x, yb - ry * 0.45, rx, ry, rough=r.uniform(0.2, 0.4), n=40, seed=int(r.integers(1 << 30)), rot=r.normal(0, 0.3))
            bp[:, 1] = np.minimum(bp[:, 1], yb + r.uniform(0, 2))            # the sea cuts the bottom off
            rocks.append(pts(bp))
            lit.append(pts(blob_pts(x - rx * 0.2, yb - ry * 0.8, rx * r.uniform(0.35, 0.6), ry * 0.3, rough=0.4, n=20,
                                    seed=int(r.integers(1 << 30)))))
    rk = K.soften(K.polys(rocks, CH, CW), S(1.5), 0.7, r, CH, CW)
    rk = K.bleed(rk, S(6), r, CH, CW, amt=0.5)
    K.wash(p, rk, [col('rock_dk'), col('rock_dk'), col('rock_sh'), col('rock')], 0.72, s, r, edge=0.7, edge_px=1.5, gran=0.55,
           var=0.5, var_px=10, charge_px=12, pool=0.8)
    litm = K.polys(lit, CH, CW)
    if litm is not None:
        litm = K.drybrush(K.soften(litm, S(1.2), 0.7, r, CH, CW), p, r, s, dry=0.4, scale=6)
        K.lift(p, litm, 0.22, s, r, rough=0.5, rough_px=6)
    R = K.reflect(land * (YD < bl + 2), S.y(745), s, r, CH, CW, squash=0.55, band=(3, 8), gap=0.45, shift=5, fade=0.6, gate_px=40,
                  jit=0.25, vsoft=1.5)
    if R is not None:
        R.a = R.a * (YD[R.sl] > bl[R.sl] + 4)
        K.wash(p, R, [col('rock_sh'), col('rock_sh'), col('rock')], 0.3, s, r, edge=0.4, edge_px=1.5, gran=0.3, var=0.45, hold=glint)

    def fctr(rr):
        x = rr.uniform(820, X1 + 10)
        return x, float(base_line(min(max(x, 880), X1 + 10))) + rr.uniform(6, 22), 0.4
    marks = K.dash_clusters(r, int(10 * (X1 - 800) / 1120), fctr, per=(1, 4), length=(25, 100), width=(2, 5), spread=(30, 5))
    fm = K.soften(K.polys(K.dash_polys(S, marks, r, curl=0.4), CH, CW), S(1.6), 0.8, r, CH, CW)
    K.lift(p, K.drybrush(fm, p, r, s, dry=0.45, scale=10), 0.55, s, r, rough=0.45, tooth=0.9)
    st('cliff base')
    # grass cap along the top edge, tapering away down the flank
    gx = np.linspace(930, X1 + 30, 140)
    gy = top_edge(gx)
    thick = lambda x: (14 + 9 * (1 + np.sin(x / 37))) * np.clip((x - 930) / 50, 0.15, 1)
    cap = [(x, y - 3) for x, y in zip(gx, gy)] + [(x, y + thick(x)) for x, y in zip(gx[::-1], gy[::-1])]
    capm = p.shape(pts(cap), soft=S(3), ragged=0.45)
    K.wash(p, capm, [col('grass'), col('grass'), col('grass_dk')], 0.8, s, r, edge=0.5, edge_px=3, gran=0.4, var=0.35, var_px=40)
    p.glaze(p.soften(capm * np.clip((YD - top_edge(np.clip(XD, 880, 4000)) - 8) / 12, 0, 1), S(3), 0.4) * capm, hexc(C['grass_dk']), 0.5,
            edge=0.1, gran=0.3)
    # tufts hanging over the lip: each a different length, lean and weight
    tufts = []
    for k in range(int(34 * (X1 - 940) / 980)):
        x = r.uniform(940, X1); y = float(top_edge(x)) + thick(x) - 4
        ln = r.uniform(5, 22)
        tufts.append(K.ribbon(pts([(x, y - 6), (x + r.normal(0, 3), y + ln * 0.5), (x + r.normal(0, 5), y + ln)]),
                              S(r.uniform(1.8, 4.5)), S(0.4), r, wob=0.3, step=max(0.8, S(2))))
    K.wash(p, K.polys(tufts, CH, CW), col('grass_dk'), 0.6, s, r, edge=0.4, edge_px=1, gran=0.3, var=0.4, var_px=10)
    st('grass', True)

    # ---------------- village houses on the clifftop (back row first): painted, not ruled
    houses = []
    xh = 1120.0
    while xh < X1 - 20:
        w = r.uniform(48, 96); h = r.uniform(36, 64)
        houses.append((xh + r.uniform(-8, 8), w, h, 1))
        xh += w + r.uniform(-12, 36)
    xh = 1160.0
    front = []
    while xh < X1 - 20:
        w = r.uniform(54, 104); h = r.uniform(32, 54)
        front.append((xh + r.uniform(-8, 8), w, h, 0))
        xh += w + r.uniform(40, 130)
    roofs = [hexc(c_) for c_ in C['roofs']]
    shut_cols = [hexc('#5a7a8a'), hexc('#6a8a5a'), hexc('#4a5a7a')]
    for (hx, w, h, back) in houses + front:
        gy0 = float(top_edge(hx + w / 2)) + (2 if back else 14)
        if back:
            gy0 -= r.uniform(14, 30)
        side = w * r.uniform(0.18, 0.42)
        x_l, x_r = hx, hx + w
        lean = r.normal(0, 1.5)
        js = 1.2
        front_poly = jit([(x_l, gy0), (x_l + lean, gy0 - h), (x_r + lean, gy0 - h), (x_r, gy0)], r, js)
        side_poly = jit([(x_r, gy0), (x_r + lean, gy0 - h), (x_r + side + lean, gy0 - h - side * 0.25), (x_r + side, gy0 - side * 0.25)], r, js)
        ridge_h = h * r.uniform(0.3, 0.8)
        ov = r.uniform(1, 7)
        mid = (x_l + x_r) / 2 + lean + r.normal(0, 3)
        hip = r.uniform() < 0.3
        if hip:     # hipped roof: no gable, a sloping front face
            inset = r.uniform(0.2, 0.38)
            gable = jit([(x_l - ov, gy0 - h), (x_l + w * inset, gy0 - h - ridge_h * 0.8), (x_r - w * inset, gy0 - h - ridge_h * 0.8),
                         (x_r + ov, gy0 - h)], r, js)
        else:
            gable = jit([(x_l - ov, gy0 - h)] + bowed((x_l - ov, gy0 - h), (mid, gy0 - h - ridge_h), r.normal(0, 1.5), r)[1:-1] +
                        [(mid, gy0 - h - ridge_h), (x_r + ov, gy0 - h)], r, js * 0.6)
        rt = (mid, gy0 - h - ridge_h) if not hip else (x_r - w * 0.3, gy0 - h - ridge_h * 0.8)
        roof_side = jit([rt, (x_r + ov, gy0 - h), (x_r + side + ov, gy0 - h - side * 0.25), (rt[0] + side, rt[1] - side * 0.25)], r, js)
        fm = K.polys([pts(front_poly)], CH, CW)
        sm = K.polys([pts(side_poly)], CH, CW)
        gm_ = K.polys([pts(gable)], CH, CW)
        rm = K.polys([pts(roof_side)], CH, CW)
        allm = K.union([fm, sm, gm_, rm], CH, CW)
        # knock the house right back to paper (front houses fully, so they sit solid in front of the back row)
        K.lift(p, K.soften(allm, S(0.8), 0.4, r, CH, CW), 1.0 if not back else 0.96, s, r, rough=0.0, tooth=0.0)
        wallm = K.soften(fm, S(0.9), 0.5, r, CH, CW)
        wc = col('wall') * r.uniform(0.97, 1.02) + (hexc('#f3e0c8') - col('wall')) * r.uniform(0, 0.6)
        K.wash(p, wallm, np.clip(wc, 0, 1), (0.85 if dusk else 0.5) * r.uniform(0.6, 1.3), s, r, edge=0.45, edge_px=1.5, gran=0.3, var=0.45, var_px=15)
        K.wash(p, K.soften(sm, S(0.9), 0.5, r, CH, CW), [col('wall_sh'), col('wall_sh'), col('rock_sh')], (0.55 if dusk else 0.45) * r.uniform(0.75, 1.2),
               s, r, edge=0.45, edge_px=1.5, gran=0.35, var=0.45, var_px=15, charge_px=20)
        i0, i1 = r.choice(len(roofs), 2)
        rc = np.clip((roofs[i0] * (1 - (t_ := r.uniform(0, 1))) + roofs[i1] * t_) * r.uniform(0.88, 1.1), 0, 1)
        roofm = K.union([rm] + ([gm_] if hip else []), CH, CW)
        K.wash(p, K.soften(roofm, S(0.9), 0.5, r, CH, CW), [rc, rc, col('roof_sh')], r.uniform(0.7, 0.95), s, r, edge=0.6, edge_px=1.5,
               gran=0.45, var=0.5, var_px=12, charge_px=14)
        if r.uniform() < 0.4:         # a few quick tile courses dragged across the roof, broken
            ys_ = np.sort(r.uniform(0.25, 0.85, int(r.integers(2, 5))))
            tl = []
            for fy in ys_:
                y_a = rt[1] + (gy0 - h - rt[1]) * fy
                tl.append(K.ribbon(pts([(rt[0] + side * 0.1 + (x_r + ov - rt[0]) * fy * 0.2, y_a),
                                        (x_r + side * (0.4 + 0.5 * fy), y_a - side * 0.2 + r.normal(0, 0.6))]),
                                   S(r.uniform(0.9, 1.6)), S(0.6), r, wob=0.6, step=max(0.8, S(2))))
            tm_ = K.drybrush(K.polys(tl, CH, CW, ss=2), p, r, s, dry=0.45, scale=4)
            if tm_ is not None:
                tm_.a = tm_.a * K.on_box(rm, tm_)
                K.wash(p, tm_, col('roof_sh'), 0.5, s, r, edge=0.2, edge_px=0.8, gran=0.3)
        if not hip:
            K.wash(p, K.soften(gm_, S(0.9), 0.5, r, CH, CW), col('wall'), 0.5 * r.uniform(0.7, 1.2), s, r, edge=0.4, edge_px=1.2, gran=0.3,
                   var=0.4)
        # shadow under the eaves, one quick stroke that does not always reach the corners
        e0, e1 = r.uniform(0, 0.15), r.uniform(0.75, 1.0)
        eave = K.ribbon(pts([(x_l + lean + w * e0, gy0 - h + 1.5), (x_l + lean + w * e1, gy0 - h + 2.5 + r.normal(0, 0.8))]),
                        S(r.uniform(2, 5)), S(r.uniform(0.8, 2.5)), r, wob=0.7, step=max(0.8, S(2)))
        K.wash(p, K.soften(K.polys([eave], CH, CW), S(0.8), 0.6, r, CH, CW), col('wall_sh'), r.uniform(0.35, 0.6), s, r, edge=0.3,
               edge_px=1, gran=0.3)
        if r.uniform() < 0.45:      # chimney
            cxh = rt[0] + side * 0.5 + r.uniform(-w * 0.15, w * 0.1)
            cyh = rt[1] - side * 0.12
            cw_, chh = r.uniform(2.5, 5), r.uniform(6, 13)
            ch = jit([(cxh - cw_, cyh + 6), (cxh - cw_, cyh - chh), (cxh + cw_, cyh - chh), (cxh + cw_, cyh + 6)], r, 0.8)
            K.wash(p, K.soften(K.polys([pts(ch)], CH, CW), S(0.6), 0.5, r, CH, CW), [rc, col('roof_sh')], 0.85, s, r, edge=0.5, edge_px=1,
                   gran=0.3, charge_px=6)
        # windows: every house its own arrangement -- a row, a pair, two storeys, one, or none on this face;
        # dabs of varying size and darkness, some with shutters, some just a dark stroke
        style = r.choice(['row', 'pair', 'two', 'one', 'none', 'row'], p=[0.25, 0.2, 0.15, 0.2, 0.08, 0.12]) if h > 30 else 'one'
        if style == 'two' and h < 44:
            style = 'pair'
        nwin = {'row': max(2, int(w // r.uniform(22, 34))), 'pair': 2, 'two': max(2, int(w // r.uniform(26, 36))), 'one': 1, 'none': 0}[style]
        rows_ = [r.uniform(0.55, 0.72)] if style != 'two' else [r.uniform(0.66, 0.76), r.uniform(0.3, 0.4)]
        ww0, wh0 = r.uniform(3, 6.5), r.uniform(4.5, 9)
        shut = r.uniform() < 0.3
        sc_ = shut_cols[int(r.integers(len(shut_cols)))]
        lit_house = r.uniform() < C['win_lit'] * 1.2
        wins, sh_, dark_, lit_ = [], [], [], []
        for fy_ in rows_:
            xs_ = (x_l + lean * 0.4 + w * (np.arange(nwin) + 0.5) / nwin + r.normal(0, 3, nwin)) if style != 'one' else \
                np.array([x_l + w * r.uniform(0.25, 0.75)])
            for wx in xs_:
                if r.uniform() < 0.1:
                    continue
                wy = gy0 - h * (fy_ + r.normal(0, 0.03))
                ww_, wh_ = ww0 * r.uniform(0.8, 1.2), wh0 * r.uniform(0.85, 1.15)
                if r.uniform() < 0.15:          # just a dark stroke
                    q = K.ribbon(pts([(wx + r.normal(0, 0.5), wy - wh_), (wx + r.normal(0, 0.8), wy + wh_)]), S(ww_ * 0.9), S(ww_ * 0.6), r,
                                 wob=0.5, step=max(0.6, S(1.5)))
                else:
                    q = pts(jit([(wx - ww_, wy - wh_), (wx + ww_, wy - wh_), (wx + ww_, wy + wh_), (wx - ww_, wy + wh_)], r, 0.9))
                (lit_ if (lit_house and r.uniform() < 0.7) else dark_).append(q)
                if shut:
                    for sg in (-1, 1):
                        sh_.append(K.ribbon(pts([(wx + sg * (ww_ + 2.2), wy - wh_), (wx + sg * (ww_ + 2.2) + r.normal(0, 0.4), wy + wh_)]),
                                            S(2.4), S(2.0), r, wob=0.5, step=max(0.6, S(1.5))))
        for qs, cc, kk in ((dark_, col('win_dk'), r.uniform(0.5, 0.85)), (lit_, col('win'), r.uniform(0.75, 0.95)), (sh_, sc_, 0.6)):
            if qs:
                K.wash(p, K.soften(K.polys(qs, CH, CW, ss=3), S(0.6), 0.6, r, CH, CW), [cc, cc, col('win_dk')] if cc is not sc_ else cc, kk,
                       s, r, edge=0.5, edge_px=0.8, gran=0.2, var=0.5, var_px=4, charge_px=5)
        if r.uniform() < 0.55 and w > 50:
            dx_ = x_l + w * r.uniform(0.2, 0.8)
            dw, dh = r.uniform(3.5, 7), h * r.uniform(0.28, 0.45)
            q = jit([(dx_ - dw, gy0), (dx_ - dw, gy0 - dh), (dx_ + dw, gy0 - dh), (dx_ + dw, gy0)], r, 0.8)
            K.wash(p, K.soften(K.polys([pts(q)], CH, CW, ss=3), S(0.6), 0.5, r, CH, CW), [col('roof_sh'), col('win_dk'), sc_],
                   r.uniform(0.55, 0.8), s, r, edge=0.5, edge_px=0.8, gran=0.3, charge_px=6)
    st('village')
    # bushes and small trees between the houses: clumps of different sizes, a few tall cypresses
    bl_ = []
    for k in range(int(r.integers(8, 13))):
        x = r.uniform(1080, X1 - 10)
        y = float(top_edge(x)) + r.uniform(-2, 10)
        for j in range(int(r.integers(1, 4))):
            rx = r.uniform(5, 24) * (1 if j == 0 else r.uniform(0.4, 0.8))
            ry = rx * r.uniform(0.6, 1.1)
            bl_.append(pts(blob_pts(x + r.normal(0, 10), y - ry * 0.5 + r.normal(0, 3), rx, ry, rough=0.35, n=36, seed=int(r.integers(1 << 30)))))
    for k in range(int(r.integers(2, 5))):
        x = r.uniform(1100, X1 - 30)
        hgt = r.uniform(30, 70)
        y = float(top_edge(x)) + 6
        bl_.append(pts(blob_pts(x, y - hgt / 2, r.uniform(5, 9), hgt / 2, rough=0.25, n=36, seed=int(r.integers(1 << 30)), rot=r.normal(0, 0.06))))
    bm = K.soften(K.polys(bl_, CH, CW), S(1.2), 0.45, r, CH, CW)
    K.wash(p, bm, [col('bush'), col('bush'), col('grass_dk'), col('grass')], 0.8, s, r, edge=0.6, edge_px=1.5, gran=0.45, var=0.35, var_px=12,
           charge_px=18)
    sh = K.Crop(bm.x0, bm.y0, bm.a * np.clip((np.arange(bm.a.shape[0])[:, None] + bm.y0 - (S.y(400))) / S(200), 0, 1)
                * (0.3 + 0.7 * K.noise(r, *bm.a.shape, S(8), 2)))
    K.wash(p, sh, col('grass_dk'), 0.45, s, r, edge=0.3, edge_px=1, gran=0.4)
    st('bushes', True)

    # ---------------- lighthouse on the tip of the headland: wobbling walls, bands painted round the tower
    LX0 = 990
    LB = float(top_edge(LX0)) + 6
    LT = 262
    bw, tw = 25, 17
    t_lean, t_bend = r.normal(0, 2.2), r.normal(0, 1.8)

    def axis(f):          # the tower's centre line: a slight lean and a hand-drawn bow
        return LX0 + t_lean * f + t_bend * np.sin(np.pi * f)
    LX = float(axis(1.0))
    fs = np.linspace(0, 1, 16)
    wl = fbm1d(16, 4, 2, seed + 61) * 1.5 + r.normal(0, 0.6, 16)
    wr = fbm1d(16, 4, 2, seed + 62) * 1.5 + r.normal(0, 0.6, 16)
    tl_, tr_ = bw + r.uniform(-1.5, 1.5), bw + r.uniform(-1.5, 1.5)
    left_e = [(axis(f) - (tl_ + (tw - tl_) * f) + wl[i], LB + (LT - LB) * f) for i, f in enumerate(fs)]
    right_e = [(axis(f) + (tr_ + (tw - tr_) * f) + wr[i], LB + (LT - LB) * f) for i, f in enumerate(fs)][::-1]
    tm = K.polys([pts(left_e + right_e)], CH, CW, ss=3)
    tms = K.soften(tm, S(0.9), 0.55, r, CH, CW)
    K.lift(p, tms, 0.95, s, r, rough=0.05, rough_px=10, tooth=0.1)
    tmf = tm.full(CH, CW)
    ax_px = np.interp(YD[tm.sl], [LT, LB], [axis(1), axis(0)])
    shade = K.Crop(tm.x0, tm.y0, tm.a * np.clip((XD[tm.sl] - ax_px + 2 + 4 * (K.noise(r, *tm.a.shape, S(20), 2) - 0.5)) / 18, 0, 1))
    K.wash(p, K.soften(shade, S(2.5), 0.6, r, CH, CW), [col('tower_sh'), col('tower_sh'), col('rock_sh')], 0.45, s, r, edge=0.35,
           edge_px=1.5, gran=0.35, var=0.5, var_px=10, charge_px=12)
    # the bands: painted round the tower quickly, each its own depth and sag, wet edges not ruled
    fa0 = r.uniform(0.19, 0.25)
    for (fa, fb) in [(fa0, fa0 + r.uniform(0.1, 0.14)), (fa0 + r.uniform(0.32, 0.37), fa0 + r.uniform(0.43, 0.49))]:
        ya, yb = LB + (LT - LB) * fa, LB + (LT - LB) * fb
        wa, wb = bw + (tw - bw) * fa + 2, bw + (tw - bw) * fb + 2
        ca, cb = axis(fa), axis(fb)
        sag_a, sag_b = r.uniform(1.5, 4), r.uniform(1.5, 4)
        ua = np.linspace(0, 1, 11)
        wob_a, wob_b = fbm1d(11, 3, 2, int(r.integers(1 << 30))) * 1.2, fbm1d(11, 3, 2, int(r.integers(1 << 30))) * 1.2
        up_ = [(cb - wb + (2 * wb) * u, yb + sag_b * (1 - (2 * u - 1) ** 2) + wob_b[i]) for i, u in enumerate(ua)]
        lo_ = [(ca + wa - (2 * wa) * u, ya + sag_a * (1 - (2 * u - 1) ** 2) + wob_a[i]) for i, u in enumerate(ua)]
        band = K.polys([pts(up_ + lo_)], CH, CW, ss=3)
        band.a = band.a * K.on_box(tms, band)
        band = K.soften(band, S(1.1), 0.75, r, CH, CW)
        band.a = band.a * K.on_box(K.soften(tm, S(0.6), 0.4, r, CH, CW), band)
        K.wash(p, band, [col('band'), col('band'), col('roof_sh')], r.uniform(0.75, 0.9), s, r, edge=0.6, edge_px=1.3,
               gran=0.4, var=0.5, var_px=8, charge_px=10, pool=0.8)
    gal = K.ribbon(pts([(LX - 27, LT - 2 + r.normal(0, 0.8)), (LX, LT - 3 + r.normal(0, 0.8)), (LX + 27, LT - 2 + r.normal(0, 0.8))]),
                   S(6), S(4.5), r, wob=0.5, step=max(0.8, S(2)))
    K.wash(p, K.soften(K.polys([gal], CH, CW, ss=3), S(0.7), 0.6, r, CH, CW), col('iron'), 0.8, s, r, edge=0.5, edge_px=1, gran=0.3,
           var=0.4, var_px=6)
    lan = K.polys([pts(jit([(LX - 12, LT - 6), (LX - 11, LT - 32), (LX + 11, LT - 32), (LX + 12, LT - 6)], r, 1.0))], CH, CW, ss=3)
    lan = K.soften(lan, S(0.7), 0.5, r, CH, CW)
    if dusk:
        halo = np.exp(-((XD - LX) ** 2 + (YD - LT + 19) ** 2) / (2 * 34 ** 2)) * (1 - tmf)
        K.lift(p, halo, 0.45, s, r, rough=0.3, rough_px=20)
        # the beam: lifted with a damp brush dragged out to the left, broken by the tooth
        beam = np.clip(1 - np.abs((YD - (LT - 19)) - (XD - LX) * 0.06) / (6 + np.abs(XD - LX) * 0.11), 0, 1) * (XD < LX) * np.exp(-(LX - XD) / 480)
        bc = K.soften(K.crop_of(beam), S(4), 0.5, r, CH, CW)
        bc.a = bc.a * (0.5 + 0.5 * K.noise(r, *bc.a.shape, S(30), 3)) * (0.6 + 0.6 * p.tooth[bc.sl])
        K.lift(p, bc, 0.32, s, r, rough=0.4, rough_px=25, tooth=1.0)
        K.wash(p, bc, col('lamp'), 0.22, s, r, edge=0.0, gran=0.1)
        K.wash(p, halo, col('lamp'), 0.3, s, r, edge=0.0, gran=0.05)
    K.lift(p, lan, 0.9, s, r, rough=0.3, rough_px=4)
    K.wash(p, lan, col('lamp'), 0.85 if dusk else 0.5, s, r, edge=0.6, edge_px=1, gran=0.1, var=0.4, var_px=6)
    bars = [K.ribbon(pts([(LX + dx + r.normal(0, 0.6), LT - 6), (LX + dx + r.normal(0, 0.8), LT - 32)]), S(1.8), S(1.1), r, wob=0.5,
                     step=max(0.8, S(2))) for dx in (-11.5, r.uniform(-1.5, 1.5), 11.5)]
    K.wash(p, K.drybrush(K.polys(bars, CH, CW, ss=3), p, r, s, dry=0.25, scale=4), col('iron'), 0.7, s, r, edge=0.3, edge_px=0.8, gran=0.1)
    cap = K.polys([pts(jit([(LX - 16, LT - 31), (LX - 6, LT - 42), (LX + r.normal(0, 1), LT - 48), (LX + 6, LT - 42), (LX + 16, LT - 31)],
                           r, 1.0))], CH, CW, ss=3)
    K.wash(p, K.soften(cap, S(0.8), 0.6, r, CH, CW), [col('band'), col('roof_sh')], 0.92, s, r, edge=0.5, edge_px=1, gran=0.3, charge_px=8)
    vane = K.ribbon(pts([(LX, LT - 47), (LX + r.normal(0, 0.6), LT - 59)]), S(2.2), S(1), r, wob=0.3, step=max(0.8, S(1.5)))
    K.wash(p, K.polys([vane], CH, CW, ss=3), col('iron'), 0.8, s, r, edge=0.3, edge_px=0.8)
    # keeper's cottage
    kx, kw, kh = 1018, 62, 34
    ky = float(top_edge(kx + kw / 2)) + 10
    km = K.polys([pts(jit([(kx, ky), (kx, ky - kh), (kx + kw, ky - kh), (kx + kw, ky)], r, 1.0))], CH, CW)
    kr = K.polys([pts(jit([(kx - 5, ky - kh), (kx + 10, ky - kh - 20), (kx + kw - 8, ky - kh - 20), (kx + kw + 5, ky - kh)], r, 1.0))], CH, CW)
    K.lift(p, K.soften(K.union([km, kr], CH, CW), S(0.8), 0.3, r, CH, CW), 0.85, s, r, rough=0.15)
    K.wash(p, K.soften(km, S(0.8), 0.3, r, CH, CW), col('wall'), 0.5, s, r, edge=0.45, edge_px=1.5, gran=0.3, var=0.35, var_px=12)
    K.wash(p, K.soften(kr, S(0.8), 0.3, r, CH, CW), [roofs[0], roofs[0], col('roof_sh')], 0.9, s, r, edge=0.55, edge_px=1.5, gran=0.4, charge_px=15)
    q = jit([(kx + 37, ky - 24), (kx + 48, ky - 24), (kx + 48, ky - 12), (kx + 37, ky - 12)], r, 0.7)
    K.wash(p, K.polys([pts(q)], CH, CW, ss=3), col('win'), 0.9, s, r, edge=0.5, edge_px=0.8, gran=0.1, var=0.4, var_px=4)
    st('lighthouse', True)

    # ---------------- sailing boats: bowed sails reserved and washed, a wobbling mast, reflections as strokes
    def sailboat(x, yw, size, flip=1):
        L = size
        hull = spline(pts([(x - L * 0.5, yw - L * 0.07), (x - L * 0.3, yw + L * 0.03), (x + L * 0.32, yw + L * 0.03),
                           (x + L * 0.55, yw - L * 0.09), (x, yw - L * 0.05), (x - L * 0.5, yw - L * 0.07)]), 8)
        hull = K.wobble_line(hull, S(L * 0.004), r, step=max(1, S(L * 0.03)), scale=6)
        hm = K.soften(K.polys([hull], CH, CW, ss=3), S(0.8), 0.55, r, CH, CW)
        mx = x + flip * L * 0.02
        mtop = yw - L * 1.15
        a_, b_, c_ = (mx - flip * L * 0.02, mtop + L * 0.04), (mx - flip * L * 0.02, yw - L * 0.12), (mx - flip * L * 0.46, yw - L * 0.14)
        main = bowed(a_, b_, 0, r, 5) + bowed(b_, c_, -flip * L * 0.02, r, 5)[1:] + bowed(c_, a_, flip * L * 0.06, r, 8)[1:]
        a_, b_, c_ = (mx + flip * L * 0.02, mtop + L * 0.12), (mx + flip * L * 0.5, yw - L * 0.12), (mx + flip * L * 0.03, yw - L * 0.13)
        jib = bowed(a_, b_, -flip * L * 0.05, r, 8) + bowed(b_, c_, flip * L * 0.015, r, 5)[1:] + bowed(c_, a_, 0, r, 5)[1:]
        mm = K.polys([pts(main)], CH, CW, ss=3)
        jm = K.polys([pts(jib)], CH, CW, ss=3)
        sails = K.soften(K.union([mm, jm], CH, CW), S(max(1.0, L * 0.012)), 0.8, r, CH, CW)
        y_w = S.y(yw)
        both = K.union([sails, hm], CH, CW)
        R = K.reflect(both, y_w, s, r, CH, CW, squash=0.75, band=(1.5, 4.5), gap=0.4, shift=max(1.5, L * 0.025), fade=0.6, gate_px=L * 0.15,
                      jit=0.25, vsoft=1)
        if R is not None:
            K.lift(p, R, 0.25, s, r, rough=0.45, rough_px=6)
            K.wash(p, R, [col('sail_sh'), col('hull')], 0.28, s, r, edge=0.4, edge_px=1, gran=0.3, var=0.5, var_px=6, charge_px=8)
        # sails: paper lifted back in one go -- no outline, the edge lost in places where the lift faded
        K.lift(p, sails, 0.9, s, r, rough=0.35, rough_px=max(4, L * 0.1), tooth=0.4)
        # one sail in shade, painted as a single loose stroke with a fold dropped in along the mast
        shm = jm if dusk else mm
        sh_ = K.Crop(shm.x0, shm.y0, shm.a * (0.55 + 0.45 * K.noise(r, *shm.a.shape, S(max(4, L * 0.2)), 2)))
        fold = np.exp(-((XX[shm.sl] - S.x(mx - flip * L * 0.08)) / S(L * 0.08)) ** 2)
        sh_.a = sh_.a * np.clip(0.35 + fold, 0, 1)
        K.wash(p, K.soften(sh_, S(max(1.2, L * 0.02)), 0.75, r, CH, CW), [col('sail_sh'), col('sail_sh'), col('sky_top')],
               r.uniform(0.3, 0.45), s, r, edge=0.45, edge_px=1, gran=0.25, var=0.5, var_px=8, charge_px=10)
        mast = K.ribbon(pts([(mx, yw - L * 0.05), (mx + r.normal(0, L * 0.006), yw - L * 0.6), (mx + r.normal(0, L * 0.01), mtop)]),
                        S(max(1.4, L * 0.016)), S(max(0.8, L * 0.007)), r, wob=0.5, step=max(0.8, S(2)))
        K.wash(p, K.drybrush(K.polys([mast], CH, CW, ss=3), p, r, s, dry=0.3, scale=5), col('hull'), 0.8, s, r, edge=0.3, edge_px=0.8,
               gran=0.1)
        K.wash(p, K.bleed(hm, S(max(2, L * 0.05)), r, CH, CW, amt=0.45), [col('hull'), col('hull'), col('wave')], 0.85, s, r, edge=0.6,
               edge_px=1.2, gran=0.35, var=0.45, var_px=8, charge_px=10, pool=0.8)
        marks = [(x - L * 0.75 + r.uniform(-5, 5), yw + L * 0.05, L * r.uniform(0.6, 0.9), max(1.2, L * 0.014)),
                 (x + r.uniform(-L * 0.1, L * 0.2), yw + L * 0.07, L * r.uniform(0.4, 0.8), max(1.0, L * 0.01))]
        K.lift(p, K.drybrush(K.soften(K.polys(K.dash_polys(S, marks, r, curl=0.4), CH, CW), S(1.2), 0.8, r, CH, CW), p, r, s, dry=0.4,
                             scale=8), 0.45, s, r, rough=0.4)

    sailboat(760, 600, 46, -1)
    sailboat(250, 650, 80, 1)
    sailboat(560, 870, 165, 1)
    st('boats', True)

    # ---------------- gulls: each its own span, wing angle and weight
    gulls = [(380, 300, 1.4), (455, 262, 1.1), (1080, 205, 0.9), (1150, 175, 0.75), (1215, 228, 0.8), (700, 380, 0.7), (1500, 300, 0.6)]
    for (gx_, gy_, k) in gulls:
        K.bird(p, S, gx_, gy_, k, col('gull'), r, span=18)
    st('gulls')

    p.rng = group_rng(seed, 'finish')
    img = p.composite().convert('RGB')
    st('final', True)
    return img


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else 'watercolour_coast.png'
    W = int(sys.argv[2]) if len(sys.argv) > 2 else 1920
    H = int(sys.argv[3]) if len(sys.argv) > 3 else 1080
    cw = sys.argv[4] if len(sys.argv) > 4 else 'Dusk'
    bl = float(sys.argv[5]) if len(sys.argv) > 5 else 0.0
    save_png(paint(W, H, colourway=cw, bleed=bl), out)
    print('saved', out)
