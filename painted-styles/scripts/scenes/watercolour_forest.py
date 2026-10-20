"""Forest path through tall trees, sun rays, a deer in the distance — Watercolour (水彩),
painted with vendor lib/watercolor.py `Watercolor` and the hand-made marks in _watercolour_kit.py. Scene C (still).

Hand-made round 1: trunks spaced in irregular groups with their own width, lean and taper; light shafts are
lifted out with a damp brush (uneven width, broken, catching the tooth) rather than straight digital rays;
low mist is lifted paper in ragged veils; every tuft and fern is its own shape.

python scripts/scenes/watercolour_forest.py out.png [W H] [colourway] [bleed]
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import drawkit
from drawkit import Scaler, seed_all, save_png, group_rng
from watercolor import Watercolor, hexc
from core import blob_pts, spline, curve, fbm1d, smoothstep, blur
import _watercolour_kit as K

STYLE = "Watercolour · 水彩"
LIB = "watercolor"
COLOURWAYS = ("Day", "Dusk")
GROUPS = ("all",)

VP = (990, 604)    # where the path disappears (design px)
GY = 606           # far forest floor line

PAL = {
    "Day": dict(
        bg='#a9c98c', bg_edge='#5f8f6c', glow='#fbe7a4', far='#8fb0a2', far_k=0.32, mid='#6f7a62', mid_k=0.55,
        near='#5d4836', near_sh='#2c2724', bark='#3a2e26', can_l='#a6c55a', can_m='#5f8c45', can_d='#2c5034',
        ground='#93ad5c', ground_d='#46683a', path='#e6c690', path_sh='#7f8a72', ray='#fff3c4', ray_k=0.3,
        deer='#7a4c2e', deer_d='#45301f', fern='#4b7a36', fern_d='#2e5a2c', mist=0.35, spark='#fff6c8'),
    "Dusk": dict(
        bg='#eab19a', bg_edge='#6f6596', glow='#fbcf92', far='#a491b4', far_k=0.36, mid='#6f5c7c', mid_k=0.6,
        near='#4e3c48', near_sh='#221c30', bark='#2a2232', can_l='#a07f9e', can_m='#47417c', can_d='#241f4a',
        ground='#c0868a', ground_d='#463d72', path='#f3c7a0', path_sh='#6d5f86', ray='#ffd39c', ray_k=0.32,
        deer='#5e3a36', deer_d='#2e2028', fern='#4a4274', fern_d='#29224a', mist=0.4, spark='#ffd8a0'),
}


class Stager:
    def __init__(self, p, stages_dir, dense):
        self.p, self.dir, self.dense, self.n = p, stages_dir, dense, 0

    def __call__(self, name, major=False):
        if not self.dir or not (self.dense or major):
            return
        save_png(self.p.composite().convert('RGB'), os.path.join(self.dir, f"{self.n:03d}_{name.replace(' ', '_')}.png"))
        self.n += 1


def poly_union(H, W, polys, ss=2):
    im = Image.new('L', (W * ss, H * ss), 0)
    d = ImageDraw.Draw(im)
    for pts in polys:
        d.polygon([(float(x) * ss, float(y) * ss) for x, y in pts], fill=255)
    return np.asarray(im.resize((W, H), Image.BILINEAR), np.float32) / 255


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
    X0, X1, Ya, Y1 = S.X0, S.X1, S.Y0, S.Y1
    st = Stager(p, stages_dir, dense_stages)
    pts = S.pts
    if include is not None and 'all' not in include:
        p.rng = group_rng(seed, 'paper'); K.paper(p, s, p.rng)
        p.rng = group_rng(seed, 'finish')
        return p.composite().convert('RGB')

    p.rng = group_rng(seed, 'paper')
    K.paper(p, s, p.rng)
    st('paper', True)
    p.rng = group_rng(seed, 'all')
    r = p.rng
    vx, vy = VP

    # ---------------- the path: S-curve from the bottom edge to the vanishing point
    t = np.linspace(0, 1, 60)
    cxs = np.interp(t, [0, 0.35, 0.7, 1], [1010, 860, 1060, vx])
    cys = Y1 + 10 - (Y1 + 10 - vy) * (1 - (1 - t) ** 1.6)
    half = 4 + 380 * (1 - t) ** 1.7
    left = [(x - h, y) for x, y, h in zip(cxs, cys, half)]
    right = [(x + h, y) for x, y, h in zip(cxs, cys, half)][::-1]
    path_m = p.shape(pts(left + right), soft=S(5), ragged=0.45)

    # ---------------- background: light glowing at the end of the path, cooler at the edges, laid wet-in-wet
    dist = np.hypot((XD - vx) / 1.3, YD - (vy - 60))
    K.wash(p, np.ones((CH, CW), np.float32), [col('bg'), col('bg'), col('glow')], 0.45, s, r, edge=0.0, gran=0.2, flocc=0.2,
           var=0.3, var_px=180, charge_px=260)
    edge = np.clip((dist - 180) / 700, 0, 1) * (0.8 + 0.4 * K.noise(r, CH, CW, S(200), 3))
    K.wash(p, edge, [col('bg_edge'), col('bg_edge'), col('far')], 0.55, s, r, edge=0.0, gran=0.3, flocc=0.3, var=0.3, var_px=150,
           blooms=2, bloom_px=(50, 100), bloom_k=0.4, bloom_zone=(edge > 0.75).astype(np.float32), charge_px=200)
    glow = np.exp(-(dist / 260) ** 2) * (0.8 + 0.4 * K.noise(r, CH, CW, S(90), 3))
    K.lift(p, glow, 0.55, s, r, rough=0.2, rough_px=60)
    K.wash(p, glow, col('glow'), 0.4, s, r, edge=0.0, gran=0.05, var=0.2)
    st('background', True)

    # ---------------- far trees: pale trunks in irregular groups, each its own width, lean and taper
    haze = 1 - 0.6 * np.exp(-(dist / 330) ** 2)
    trunks = []
    x = X0 - 40
    while x < X1 + 40:
        x += r.uniform(14, 34) if r.uniform() < 0.45 else r.uniform(40, 95)       # clumps and gaps
        if abs(x - vx) < 26:
            continue
        w = r.uniform(5, 16)
        base = GY + r.uniform(-4, 6)
        lean = r.normal(0, 7)
        trunks.append(K.ribbon(pts([(x, base), (x + lean * 0.5 + r.normal(0, 2), (base + Ya) / 2), (x + lean, Ya - 20)]),
                               S(w), S(w * r.uniform(0.55, 0.85)), r, wob=0.12, step=max(1, S(6))))
        if r.uniform() < 0.25:      # a forking branch
            yb_ = r.uniform(120, 400); sg = r.choice([-1, 1])
            trunks.append(K.ribbon(pts([(x + lean * (base - yb_) / (base - Ya), yb_), (x + sg * r.uniform(20, 45), yb_ - r.uniform(40, 90))]),
                                   S(w * 0.4), S(1), r, wob=0.2, step=max(1, S(3))))
    far_c = K.soften(K.polys(trunks, CH, CW), S(1.3), 0.4, r, CH, CW)
    far_c.a = far_c.a * haze[far_c.sl]
    K.wash(p, far_c, [col('far'), col('far'), col('mid')], C['far_k'] * 1.6, s, r, edge=0.45, edge_px=2, gran=0.35, var=0.35, var_px=40)
    fc = []
    for x in np.arange(X0 - 60, X1 + 60, 70):
        fc.append((S.x(x + r.normal(0, 20)), S.y(r.uniform(Ya + 20, 260) if Ya < 0 else r.uniform(30, 260)), S(r.uniform(60, 110)), S(r.uniform(50, 90))))
    fcm = p.blobs(fc, rough=0.35, soft=S(10), ragged=0.45)
    K.wash(p, fcm * np.clip((300 - YD) / 120, 0.3, 1) * haze, col('far'), C['far_k'] * 1.4, s, r, edge=0.35, edge_px=4, gran=0.3,
           var=0.4, var_px=60, blooms=1, bloom_px=(30, 60))
    st('far trees', True)

    # ---------------- forest floor and the path
    # the floor wash's top edge wanders, dries hard in places and is lost into the glow in others
    gl_ = GY + 7 * fbm1d(CW, max(4, S(160)), 4, seed + 71)[None, :] + 2.5 * fbm1d(CW, max(3, S(18)), 2, seed + 72)[None, :]
    g_hard = np.clip((YD - gl_ + 6) / 3, 0, 1)
    g_soft = np.clip((YD - gl_ + 18) / 40, 0, 1)
    lost_ = smoothstep(0.45, 0.65, K.noise(r, CH, CW, S(150), 3))
    ground = (g_hard * (1 - lost_) + g_soft * lost_).astype(np.float32)
    K.wash(p, ground * (1 - path_m), [col('ground'), col('ground'), col('ground_d')], 0.6, s, r, edge=0.0, gran=0.45, flocc=0.4,
           var=0.4, var_px=90, charge_px=140)
    deep = ground * np.clip((YD - GY) / (Y1 - GY), 0, 1) ** 1.1
    K.wash(p, K.soften(K.crop_of(deep * (1 - path_m)), S(6), 0.4, r, CH, CW), col('ground_d'), 0.6, s, r, edge=0.0, gran=0.45, var=0.4)
    K.wash(p, path_m, col('path'), 0.6, s, r, edge=0.5, edge_px=3, gran=0.55, flocc=0.4, var=0.35, var_px=60)
    K.wash(p, path_m * np.clip((YD - 700) / 400, 0, 1), col('path_sh'), 0.25, s, r, edge=0.0, gran=0.4)
    st('floor', True)

    # ---------------- mid trees: darker trunks standing on the floor between far and near
    mids = [(150, 660, 30), (330, 650, 24), (560, 642, 26), (720, 630, 18), (840, 622, 14), (1120, 622, 14),
            (1230, 632, 20), (1390, 648, 28), (1520, 655, 22), (1700, 668, 32), (1850, 650, 22), (-90, 670, 30), (2010, 665, 30)]
    mp = []
    for (x, base, w) in mids:
        if x + w < X0 or x - w > X1:
            continue
        x += r.normal(0, 10); w *= r.uniform(0.75, 1.25)
        lean = r.normal(0, w * 0.4)
        flare = w * r.uniform(0.25, 0.45)
        mp.append(pts([(x - w / 2 - flare, base + 3), (x - w / 2, base - w * 0.8)] + [(x - w * 0.38 + lean * f + r.normal(0, 0.8), base - (base - Ya + 20) * f) for f in np.linspace(0.1, 1, 7)]
                      + [(x + w * 0.38 + lean * f + r.normal(0, 0.8), base - (base - Ya + 20) * f) for f in np.linspace(1, 0.1, 7)]
                      + [(x + w / 2, base - w * 0.8), (x + w / 2 + flare, base + 3)]))
        if r.uniform() < 0.5:       # a broken-off branch stub
            yb_ = r.uniform(150, base - 150); sg = r.choice([-1, 1])
            xb_ = x + lean * (base - yb_) / (base - Ya)
            mp.append(K.ribbon(pts([(xb_, yb_), (xb_ + sg * r.uniform(15, 35), yb_ - r.uniform(10, 30))]), S(w * 0.3), S(w * 0.1), r, wob=0.3,
                               step=max(1, S(3))))
    mid_c = K.soften(K.polys(mp, CH, CW), S(1.4), 0.4, r, CH, CW)
    K.wash(p, mid_c, [col('mid'), col('mid'), col('near')], C['mid_k'], s, r, edge=0.55, edge_px=2.5, gran=0.4, var=0.35, var_px=40, charge_px=80)
    st('mid trees', True)

    # ---------------- near trees: big trunks framing the path, bark strokes, shadow side
    nears = [(110, 1000, 130), (395, 905, 78), (650, 790, 44), (1330, 800, 46), (1580, 900, 86), (1800, 1020, 150),
             (-170, 1060, 120), (2080, 1050, 120)]
    shadows = np.zeros((CH, CW), np.float32)
    for (x, base, w) in nears:
        if x + w < X0 - 20 or x - w > X1 + 20:
            continue
        flare = w * r.uniform(0.15, 0.3)
        lean = r.normal(0, w * 0.1)
        wl = fbm1d(9, 3, 2, int(r.integers(1 << 30))) * w * 0.03
        wr = fbm1d(9, 3, 2, int(r.integers(1 << 30))) * w * 0.03
        up_l = [(x - w / 2 + (w * 0.08) * f + lean * f + wl[i], base - w * 0.7 - (base - w * 0.7 - Ya + 30) * f) for i, f in enumerate(np.linspace(0, 1, 9))]
        up_r = [(x + w / 2 - (w * 0.08) * f + lean * f + wr[i], base - w * 0.7 - (base - w * 0.7 - Ya + 30) * f) for i, f in enumerate(np.linspace(0, 1, 9))]
        poly = ([(x - w / 2 - flare, base + 8), (x - w / 2 - flare * 0.55, base - w * 0.12), (x - w / 2 - flare * 0.15, base - w * 0.35)] + up_l
                + up_r[::-1] + [(x + w / 2 + flare * 0.15, base - w * 0.35), (x + w / 2 + flare * 0.55, base - w * 0.12), (x + w / 2 + flare, base + 8)])
        tm = K.soften(K.polys([pts(poly)], CH, CW), S(1.4), 0.35, r, CH, CW)
        K.wash(p, tm, [col('near'), col('near'), col('near_sh')], 0.85, s, r, edge=0.6, edge_px=3, gran=0.5, flocc=0.4, var=0.35,
               var_px=50, charge_px=90, blooms=int(r.integers(0, 2)), bloom_px=(15, 30))
        # the side away from the light (left) in shadow, wet-in-wet, kept inside the trunk
        side = K.Crop(tm.x0, tm.y0, tm.a * np.clip((x + lean * (1 - YD[tm.sl] / 1080) - XD[tm.sl]) / (w * 0.5) + 0.35, 0, 1))
        sd_ = K.soften(side, S(6), 0.45, r, CH, CW)
        sd_.a = sd_.a * K.on_box(tm, sd_)
        K.wash(p, sd_, col('near_sh'), 0.55, s, r, edge=0.1, gran=0.45, var=0.35)
        for k in range(int(w / 9)):
            bx_ = x + r.uniform(-w * 0.38, w * 0.38)
            y_a = r.uniform(80, base - 40); ln = r.uniform(60, 220)
            p.stroke(pts([(bx_, y_a), (bx_ + r.normal(0, 3), y_a + ln * 0.5), (bx_ + r.normal(0, 4), min(base - 10, y_a + ln))]),
                     S(r.uniform(2, 4)), hexc(C['bark']), 0.35, dry=0.55, taper=(0.3, 0.4))
        clump = [pts(blob_pts(x + dx_ * w + r.normal(0, w * 0.1), base + 4, w * r.uniform(0.2, 0.42), w * 0.09 + r.uniform(3, 8), rough=0.4, n=40,
                              seed=int(r.integers(1 << 30)))) for dx_ in r.uniform(-0.7, 0.7, int(r.integers(2, 5)))]
        K.wash(p, K.soften(K.polys(clump, CH, CW), S(2.5), 0.5, r, CH, CW), [col('fern_d'), col('fern_d'), col('fern')], 0.6, s, r,
               edge=0.5, edge_px=2, gran=0.4, var=0.35, var_px=20)
        blades = []
        for k in range(int(4 + w / 12)):
            gx_ = x + r.uniform(-w * 0.9, w * 0.9); gh = r.uniform(10, 38) * (0.6 + w / 150)
            ln_ = r.normal(0, gh * 0.25)
            blades.append(K.ribbon(pts([(gx_, base + 8), (gx_ + ln_ * 0.4, base + 8 - gh * 0.5), (gx_ + ln_, base + 8 - gh)]),
                                   S(r.uniform(2, 4.5)), S(0.4), r, wob=0.3, step=max(0.8, S(2))))
        K.wash(p, K.polys(blades, CH, CW), col('fern'), 0.6, s, r, edge=0.45, edge_px=1, gran=0.3, var=0.35, var_px=10)
        # cast shadow across the floor / path, away from the sun (down-left)
        dxs, dys = (x - vx) * 0.35 - 120, 120 + (base - GY) * 0.6
        sh = [(x - w * 0.45, base), (x + w * 0.45, base), (x + dxs + w * 0.9, base + dys), (x + dxs - w * 0.9, base + dys)]
        shadows = np.maximum(shadows, poly_union(CH, CW, [pts(sh)]) * np.clip(1 - (YD - base) / (dys + 1), 0, 1) ** 0.5)
    st('near trees', True)
    shadows = K.soften(K.crop_of(shadows * ground), S(10), 0.5, r, CH, CW)
    K.wash(p, shadows, col('path_sh'), 0.35, s, r, edge=0.25, edge_px=4, gran=0.35, var=0.35, var_px=60)
    st('cast shadows', True)

    # ---------------- canopy: foliage masses along the top, three glazes kept inside the crown
    crown = []
    for x in np.arange(X0 - 80, X1 + 80, 85):
        yc = r.uniform(Ya - 40, 120) if Ya < 0 else r.uniform(-40, 120)
        crown.append((S.x(x + r.normal(0, 25)), S.y(yc), S(r.uniform(90, 150)), S(r.uniform(70, 120))))
    for (x, y_) in [(110, 230), (395, 200), (1580, 210), (1800, 240), (650, 160), (1330, 170)]:
        crown.append((S.x(x + r.normal(0, 30)), S.y(y_), S(r.uniform(110, 160)), S(r.uniform(70, 100))))
    keep_open = np.exp(-(((XD - 1250) / 360) ** 2 + ((YD - 120) / 220) ** 2))       # a gap where the light comes in
    cm = p.blobs(crown, rough=0.45, soft=S(6), ragged=0.5) * (1 - 0.85 * keep_open)
    K.wash(p, cm, [col('can_l'), col('can_l'), col('can_m')], 0.7, s, r, edge=0.55, edge_px=4, gran=0.45, flocc=0.4, var=0.4, var_px=60,
           blooms=1, bloom_px=(30, 60), bloom_k=0.35, charge_px=120)
    items = [(cx_ + S(30), cy_ + S(25), rx * 0.7, ry * 0.6) for (cx_, cy_, rx, ry) in crown]
    m2 = p.blobs(items, rough=0.45, soft=S(10), ragged=0.5) * np.clip(cm * 1.3, 0, 1)
    K.wash(p, m2, col('can_m'), 0.7, s, r, edge=0.4, edge_px=4, gran=0.45, var=0.4, var_px=50, blooms=1, bloom_px=(25, 50), bloom_k=0.35)
    items = [(cx_ + S(40), cy_ + S(45), rx * 0.45, ry * 0.4) for (cx_, cy_, rx, ry) in crown]
    m3 = p.blobs(items, rough=0.45, soft=S(14), ragged=0.5) * np.clip(cm * 1.3, 0, 1)
    K.wash(p, m3, col('can_d'), 0.6, s, r, edge=0.25, edge_px=4, gran=0.45, var=0.4, var_px=50)
    st('canopy', True)

    # ---------------- light shafts: lifted out with a damp flat brush -- uneven width, broken, catching the tooth
    sxr, syr = 1450, -160
    rays = []
    for a0, w0, w1, k in [(1.93, 10, 70, 0.9), (2.02, 6, 40, 0.65), (2.11, 14, 110, 1.0), (2.21, 8, 55, 0.75), (2.30, 10, 80, 0.85),
                          (1.82, 6, 45, 0.6), (2.40, 6, 40, 0.5)]:
        a_ = a0 + r.normal(0, 0.01)
        L0, L1 = (Ya - 40 - syr) / np.sin(a_), (GY + 240 - syr) / np.sin(a_)
        c0 = (sxr + np.cos(a_) * L0, syr + np.sin(a_) * L0)
        c1 = (sxr + np.cos(a_) * L1, syr + np.sin(a_) * L1)
        mid_ = ((c0[0] + c1[0]) / 2 + r.normal(0, 6), (c0[1] + c1[1]) / 2)
        rm_ = K.polys([K.ribbon(pts([c0, mid_, c1]), S(w0 * r.uniform(0.7, 1.3)), S(w1 * r.uniform(0.7, 1.3)), r, wob=0.45,
                                step=max(1, S(10)))], CH, CW, ss=1)
        rm_ = K.soften(rm_, S(r.uniform(4, 8)), 0.6, r, CH, CW)
        hh, ww = rm_.a.shape
        yy_ = YD[rm_.sl]
        rm_.a = rm_.a * k * np.clip((yy_ + 40) / 200, 0, 1) * np.clip((GY + 260 - yy_) / 200, 0, 1) * (0.5 + 0.6 * K.noise(r, hh, ww, S(90), 3))
        rays.append(rm_)
    rays = K.union(rays, CH, CW)
    K.lift(p, rays, 0.72, s, r, rough=0.3, rough_px=25, tooth=1.0)
    K.wash(p, rays, col('ray'), C['ray_k'], s, r, edge=0.0, gran=0.05, var=0.3)
    st('rays', True)

    # ---------------- low mist where the path meets the light: ragged veils of lifted paper
    veils = []
    xa = X0 - 200
    while xa < X1 + 100:
        ln = r.uniform(200, 520)
        veils.append(blob_pts(S.x(xa + ln / 2), S.y(GY + 4 + r.normal(0, 26)), S(ln / 2), S(r.uniform(14, 44)), rough=0.5, n=80,
                              seed=int(r.integers(1 << 30)), rot=r.normal(0, 0.04)))
        xa += ln * r.uniform(0.5, 1.0)
    mv = K.soften(K.polys(veils, CH, CW, ss=1), S(r.uniform(14, 18)), 0.8, r, CH, CW)
    mv.a = mv.a * (0.15 + 0.85 * K.noise(r, *mv.a.shape, S(110), 3) ** 1.5)
    K.lift(p, mv, C['mist'], s, r, rough=0.3, rough_px=25, tooth=0.9)
    st('mist', True)

    # ---------------- the deer, standing on the path in the light, head up
    DX, DY = vx + 8, vy + 14          # hooves
    u = 1.2
    body = blob_pts(DX, DY - 34 * u, 25 * u, 11 * u, rough=0.06, seed=seed + 31)
    neck = [(DX - 22 * u, DY - 40 * u), (DX - 27 * u, DY - 56 * u), (DX - 18 * u, DY - 61 * u), (DX - 9 * u, DY - 42 * u)]
    chest = blob_pts(DX - 15 * u, DY - 35 * u, 11 * u, 11 * u, rough=0.05, seed=seed + 33)
    haunch = blob_pts(DX + 15 * u, DY - 36 * u, 11 * u, 11.5 * u, rough=0.05, seed=seed + 34)
    head = blob_pts(DX - 25 * u, DY - 60 * u, 8 * u, 5.5 * u, rough=0.05, seed=seed + 32, rot=0.45)
    snout = [(DX - 29 * u, DY - 63 * u), (DX - 37 * u, DY - 56 * u), (DX - 34 * u, DY - 53 * u), (DX - 24 * u, DY - 56 * u)]
    ear1 = Watercolor.petal_pts(DX - 20 * u, DY - 63 * u, -1.05, 10 * u, 3.4 * u, n=16)
    ear2 = Watercolor.petal_pts(DX - 24 * u, DY - 64 * u, -2.0, 9 * u, 3.2 * u, n=16)
    tail = [(DX + 23 * u, DY - 40 * u), (DX + 30 * u, DY - 38 * u), (DX + 25 * u, DY - 33 * u)]
    parts = [pts(body), pts(chest), pts(haunch), pts(neck), pts(head), pts(snout), pts(ear1), pts(ear2), pts(tail)]
    for (lx, kx, ex_) in [(-18, -18, -19), (-11, -10, -9), (12, 16, 13), (18, 22, 20)]:
        parts.append(K.ribbon(pts([(DX + lx * u, DY - 30 * u), (DX + kx * u, DY - 13 * u), (DX + ex_ * u, DY)]), S(4.2 * u), S(2.4 * u), r,
                              wob=0.2, step=max(0.6, S(1.5))))
    deer = K.soften(K.polys(parts, CH, CW, ss=3), S(0.6), 0.3, r, CH, CW)
    K.lift(p, deer, 0.2, s, r, rough=0.2)
    K.wash(p, deer, [col('deer'), col('deer'), col('deer_d')], 0.9, s, r, edge=0.55, edge_px=1.2, gran=0.25, var=0.3, var_px=8, charge_px=10)
    dd = K.Crop(deer.x0, deer.y0, deer.a * np.clip((YD[deer.sl] - (DY - 36)) / 14, 0, 1) * (YD[deer.sl] < DY - 12))
    K.wash(p, dd, col('deer_d'), 0.35, s, r, edge=0.0, gran=0.2)
    K.lift(p, K.polys([K.ribbon(pts([(DX + 23 * u, DY - 37 * u), (DX + 27 * u, DY - 36 * u)]), S(2.5), S(1.8), r, wob=0.2, step=max(0.6, S(1)))],
                      CH, CW, ss=3), 0.6, s, r, rough=0.2)   # white tail tip
    K.wash(p, np.exp(-(((XD - DX) / 26) ** 2 + ((YD - DY - 1) / 2.5) ** 2)), col('path_sh'), 0.35, s, r, edge=0.0, gran=0.2)
    st('deer', True)

    # ---------------- foreground: ferns and grass tufts at the path edges, every one its own shape
    def fern(x, y, size, ang0):
        leaf = ([], [])
        stems = []
        nfr = int(r.integers(3, 7))
        spread = r.uniform(0.25, 0.42)
        for k in range(nfr):
            a = ang0 + (k - (nfr - 1) / 2) * spread + r.normal(0, 0.1)
            ln = size * r.uniform(0.55, 1.05)
            ex_, ey_ = x + np.cos(a) * ln, y + np.sin(a) * ln
            bend = ln * r.uniform(0.05, 0.2) * r.choice([-1, 1])
            cv = curve((x, y), (ex_, ey_), bend, 12)
            stems.append(K.ribbon(pts(cv), S(3.2), S(0.8), r, wob=0.2, step=max(0.8, S(3))))
            nl = int(r.integers(7, 13))
            lsz = r.uniform(0.18, 0.3)
            for j in range(1, nl):
                f = j / nl
                px_, py_ = cv[int(f * (len(cv) - 1))]
                for sgn in (-1, 1):
                    if r.uniform() < 0.08:
                        continue
                    la = a + sgn * r.uniform(0.85, 1.25)
                    ll = (ln * lsz * (1 - f) + ln * 0.04) * r.uniform(0.75, 1.2)
                    leaf[(j + k) % 2].append(pts(Watercolor.petal_pts(px_, py_, la, ll, ll * r.uniform(0.18, 0.3), n=14, curl=r.normal(0, 0.1))))
        K.wash(p, K.polys(stems, CH, CW), col('fern_d'), 0.6, s, r, edge=0.4, edge_px=1, gran=0.3)
        for i, ck in enumerate(('fern', 'fern_d')):
            lm = K.soften(K.polys(leaf[i], CH, CW), S(0.8), 0.35, r, CH, CW)
            K.wash(p, lm, [col(ck), col(ck), col('ground_d')], 0.75, s, r, edge=0.55, edge_px=1.5, gran=0.35, var=0.35, var_px=20, charge_px=40)

    for (x, y, sz, a) in [(130, 1090, 230, -1.75), (330, 1100, 200, -1.35), (1640, 1095, 220, -1.6), (1840, 1080, 250, -1.9)]:
        fern(x + r.normal(0, 10), y, sz * r.uniform(0.85, 1.15), a + r.normal(0, 0.08))
    blades = ([], [])
    for _ in range(int(45 * (X1 - X0) / 1920)):
        x = r.uniform(X0, X1)
        y = r.uniform(820, Y1 + 5)
        fy_ = (y - vy) / (Y1 - vy)
        if abs(x - np.interp(y, cys[::-1], cxs[::-1])) < 400 * fy_ ** 1.7 * 0.9:
            continue
        h = r.uniform(18, 66) * (0.5 + fy_)
        which = int(r.uniform() < 0.5)
        nbl = int(r.integers(2, 7))
        fan = r.uniform(0.15, 0.45)
        for b in range(nbl):
            lean = (b - (nbl - 1) / 2) * h * fan + r.normal(0, h * 0.1)
            hb = h * r.uniform(0.55, 1.0)
            blades[which].append(K.ribbon(pts([(x + r.normal(0, 2), y), (x + lean * 0.35, y - hb * 0.55), (x + lean, y - hb)]),
                                          S(r.uniform(2, 4.5)) * (0.6 + fy_), S(0.4), r, wob=0.3, step=max(0.8, S(2))))
    for i, ck in enumerate(('fern', 'fern_d')):
        K.wash(p, K.polys(blades[i], CH, CW), [col(ck), col(ck), col('ground_d')], 0.65, s, r, edge=0.5, edge_px=1.2, gran=0.35, var=0.35,
               var_px=15, charge_px=30)
    st('foreground', True)

    p.rng = group_rng(seed, 'finish')
    img = p.composite().convert('RGB')
    st('final', True)
    return img


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else 'watercolour_forest.png'
    W = int(sys.argv[2]) if len(sys.argv) > 2 else 1920
    H = int(sys.argv[3]) if len(sys.argv) > 3 else 1080
    cw = sys.argv[4] if len(sys.argv) > 4 else 'Dusk'
    bl = float(sys.argv[5]) if len(sys.argv) > 5 else 0.0
    save_png(paint(W, H, colourway=cw, bleed=bl), out)
    print('saved', out)
