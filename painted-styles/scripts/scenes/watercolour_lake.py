"""Mountain lake — Watercolour (水彩), painted with vendor lib/watercolor.py `Watercolor`.

Phase 2: bleed-aware, layer groups with per-group RNG, two colourways (Day / Dusk), dense draw-on stages.

python scripts/scenes/watercolour_lake.py out.png [W H] [colourway] [bleed]
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
import numpy as np
from PIL import Image

import drawkit
from drawkit import Scaler, seed_all, save_png, group_rng
from watercolor import Watercolor, hexc
from core import blob_pts, spline, curve, fbm1d

STYLE = "Watercolour · 水彩"
LIB = "watercolor"
COLOURWAYS = ("Day", "Dusk")
GROUPS = ("sky", "clouds", "far", "near", "water", "mist", "boat", "birds", "reeds")

Y0 = 640   # waterline (design px)

PAL = {
    "Dusk": dict(
        sky_top='#6f78a8', sky_bot='#c99bb0', sky_k=0.55, low='#f2a88c', low_k=0.5,
        glow='#f7cf8e', glow_k=0.35, glow_lift=0.45,
        cloud='#8f82ad', cloud_k=0.34, cloud_under='#f0a990', cloud_under_k=0.32, cloud_lift=0.18,
        far='#a08fb8', far_lift=0.45, near='#4f6a84', near_shade='#33475a',
        pines=('#2c4a40', '#355544', '#2a4038'), pine_r='#3a5550', pine_sh='#1c2e33', shore='#3b3a3a',
        trunk='#4a3a2e', w_top='#f0b08f', w_top_k=0.45, w_deep='#46679a',
        r_far='#9a8fb5', r_near='#566a86', r_pine='#2c4a40', r_glow='#f7cf8e',
        mist=0.6, bird='#3a3550', bank='#6b6a3c', reeds=('#4f5a2c', '#6d6a34', '#3c4628'),
        hull='#8a5a3a', rower='#3e4a68'),
    "Day": dict(
        sky_top='#4f86c6', sky_bot='#b7d3ea', sky_k=0.6, low='#f3e3c0', low_k=0.32,
        glow='#fff0c4', glow_k=0.18, glow_lift=0.25,
        cloud='#8d9bb8', cloud_k=0.22, cloud_under='#a9b3c9', cloud_under_k=0.2, cloud_lift=0.62,
        far='#8a9cc4', far_lift=0.3, near='#4f7a72', near_shade='#2f4f50',
        pines=('#2a5a3e', '#346548', '#284a36'), pine_r='#386052', pine_sh='#16302a', shore='#4a4236',
        trunk='#5a4230', w_top='#cfe2ea', w_top_k=0.4, w_deep='#2f6ea8',
        r_far='#8fa0c4', r_near='#4f7a72', r_pine='#2a5a3e', r_glow='#fff0c4',
        mist=0.5, bird='#30384a', bank='#6f7d3a', reeds=('#4a6a2a', '#6f7f34', '#3a5226'),
        hull='#9a5a34', rower='#b0423a'),
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
    n = 160
    grid = np.linspace(-1000, 2920, n)
    v = fbm1d(n, scale_px / (grid[1] - grid[0]), octaves, seed)
    return np.interp(xs, grid, v)


def poly_union(H, W, polys, ss=2):
    im = Image.new('L', (W * ss, H * ss), 0)
    from PIL import ImageDraw
    d = ImageDraw.Draw(im)
    for pts in polys:
        d.polygon([(float(x) * ss, float(y) * ss) for x, y in pts], fill=255)
    im = im.resize((W, H), Image.BILINEAR)
    return np.asarray(im, np.float32) / 255


def bands(H, W, lines, soft):
    """many thick soft strokes [(pts, width), ...] as ONE mask (one blur instead of one per stroke)"""
    from PIL import ImageDraw
    from core import blur
    im = Image.new('L', (W, H), 0)
    d = ImageDraw.Draw(im)
    for pts, width in lines:
        d.line([tuple(map(float, q)) for q in pts], fill=255, width=max(1, int(width)), joint='curve')
    return blur(np.asarray(im, np.float32) / 255, soft)


def paint(W=1920, H=1080, seed=1, colourway="Dusk", bleed=0.0, include=None,
          stages_dir=None, dense_stages=False):
    seed_all(seed)
    C = PAL[colourway]
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
    p.paper()
    st('paper', True)

    # ================= geometry (masks other groups need), painted by nobody, always computed
    p.rng = group_rng(seed, 'geometry')
    g = p.rng
    glow = np.exp(-(((XD - 1240) / 330) ** 2 + ((YD - 560) / 200) ** 2)) * (YD < Y0)
    nx = int(90 * (X1 - X0) / 1920) + 2
    xs = np.linspace(X0, X1, nx)
    rough = ridge_noise(seed + 11, xs)
    far_y = (370 - 70 * np.exp(-((xs - 1250) / 170) ** 2) - 45 * np.exp(-((xs - 560) / 240) ** 2)
             - 30 * np.exp(-((xs - 1700) / 200) ** 2) + 18 * rough + 30 * np.exp(-((xs - 900) / 150) ** 2))
    far = [(X0 - 20, Y0 + 4)] + [(x, y) for x, y in zip(xs, far_y)] + [(X1 + 20, Y0 + 4)]
    far_m = p.shape(S.pts(far), soft=S(10), ragged=0.35)
    rough2 = ridge_noise(seed + 21, xs)
    near_y = (590 - 150 * np.exp(-((xs - 330) / 330) ** 2) - 90 * np.exp(-((xs - 820) / 220) ** 2)
              - 45 * np.exp(-((xs - 1700) / 200) ** 2) + 12 * rough2)
    near = [(X0 - 20, Y0 + 4)] + [(x, y) for x, y in zip(xs, near_y)] + [(X1 + 20, Y0 + 4)]
    near_m = p.shape(S.pts(near), soft=S(5), ragged=0.3)

    left = [(75, 470), (130, 430), (190, 500), (245, 420), (300, 475), (355, 520), (400, 455),
            (455, 540), (505, 560), (165, 545), (275, 555), (425, 585)]
    left = [(-150, 515), (-80, 480), (-20, 535)] + left          # only visible with bleed
    pines = []   # (x, top, root, colour, mask)
    for (x, top) in left:
        jx = g.normal(0, 4)
        col = C['pines'][int(g.integers(3))]
        pines.append((S.x(x + jx), S.y(top), S.y(652), col))
    for (x, top) in [(1520, 575), (1580, 545), (1640, 590), (1720, 565), (1785, 600)]:
        pines.append((S.x(x), S.y(top), S.y(650), C['pine_r']))
    pine_data = []
    for (x, top, root, col) in pines:
        h = root - top
        if x + h * 0.3 < 0 or x - h * 0.3 > CW:
            continue
        polys = []
        for k in range(5):
            f0 = k / 5
            ty = top + h * (f0 * 0.82)
            by = top + h * min(1.0, (f0 + 0.32) * 0.88)
            half = h * (0.10 + 0.16 * (k + 1) / 5)
            j = lambda a: a + g.normal(0, h * 0.012)
            polys.append([(j(x), ty), (j(x - half * 0.55), (ty + by) / 2), (j(x - half), by),
                          (x, by - h * 0.03), (j(x + half), by), (j(x + half * 0.55), (ty + by) / 2)])
        m = p.soften(poly_union(CH, CW, polys), S(1.6), 0.3)
        pine_data.append((x, top, root, col, m))
    allp = np.max(np.stack([d[4] for d in pine_data]), 0) if pine_data else np.zeros((CH, CW), np.float32)

    # ================= sky: wet-in-wet gradient, warm low band, glow behind the peak
    if 'sky' in inc:
        p.rng = group_rng(seed, 'sky')
        p.gradient_wash(S.y(0), S.y(352), top=hexc(C['sky_top']), bottom=hexc(C['sky_bot']), strength=C['sky_k'],
                        soft_bottom=S(40), gran=0.1)
        st('sky wash')
        low = np.clip((YD - 192) / 448, 0, 1) * (YD < Y0 + 4)
        p.glaze(low, hexc(C['low']), C['low_k'], edge=0.0, gran=0.08, variation=0.15)
        st('sky low')
        p.lift(glow, C['glow_lift'])
        p.glaze(glow, hexc(C['glow']), C['glow_k'], edge=0.0, gran=0.1, variation=0.1)
        st('sky glow', True)

    # ================= clouds: a few thin, soft wet-in-wet streaks high up
    if 'clouds' in inc:
        p.rng = group_rng(seed, 'clouds')
        r = p.rng
        for i, (cx, cy, ln) in enumerate([(330, 120, 520), (880, 190, 400), (1230, 95, 560), (1750, 150, 420), (-60, 230, 300)]):
            if cx + ln < X0 - 50:
                continue
            items = []
            for k in range(6):
                t = k / 5 - 0.5
                items.append((S.x(cx + t * ln * 0.9 + r.normal(0, 18)), S.y(cy + r.normal(0, 5) + 10 * t * t),
                              S(ln * r.uniform(0.12, 0.22)), S(r.uniform(8, 18) * (1 - 0.9 * t * t))))
            m = p.blobs(items, rough=0.35, soft=S(12), ragged=0.4)
            if C['cloud_lift'] > 0:
                p.lift(m, C['cloud_lift'])
            p.glaze(m, hexc(C['cloud']), C['cloud_k'], edge=0.15, gran=0.15, variation=0.4)
            under = m * np.clip((YY - S.y(cy - 4)) / S(14), 0, 1)
            p.glaze(p.soften(under, S(3), 0.3) * m, hexc(C['cloud_under']), C['cloud_under_k'], edge=0.1, gran=0.1)
            st(f'cloud {i + 1}', i == 4)

    # ================= far range
    if 'far' in inc:
        p.rng = group_rng(seed, 'far')
        p.glaze(far_m, hexc(C['far']), 0.5, edge=0.3, gran=0.2, variation=0.25)
        st('far glaze')
        p.lift(far_m * np.clip((YD - 470) / 170, 0, 1), C['far_lift'])
        st('far haze', True)

    # ================= near range + pines + shore
    if 'near' in inc:
        p.rng = group_rng(seed, 'near')
        r = p.rng
        p.glaze(near_m, hexc(C['near']), 0.8, edge=0.55, gran=0.25, variation=0.3)
        st('near glaze')
        shade = near_m * np.clip(1 - (XD - 200) / 800, 0, 1) * np.clip((YD - 470) / 160, 0, 1)
        p.glaze(p.soften(shade, S(14), 0.4), hexc(C['near_shade']), 0.45, edge=0.1, gran=0.2)
        st('near shade')
        for i, (x, top, root, col, m) in enumerate(pine_data):
            h = root - top
            p.stroke([(x, root), (x, top + h * 0.1)], max(1.5 * s, h * 0.035), hexc(C['trunk']), 0.85, dry=0.25, taper=(0.02, 0.5))
            p.glaze(m, hexc(col), 0.8, edge=0.7, gran=0.3, variation=0.35)
            sh = m * np.clip((XX - x) / (h * 0.15 + 1), 0, 1)
            p.glaze(p.soften(sh, S(4), 0.3) * m, hexc(C['pine_sh']), 0.45, edge=0.1, gran=0.3)
            st(f'pine {i + 1}')
        shore = p.shape(S.pts([(X0 - 20, 652), (X0 - 20, 632), (0, 630), (200, 632), (540, 640), (600, 652)]), soft=S(3), ragged=0.3)
        shore = np.maximum(shore, p.shape(S.pts([(1470, 651), (1500, 641), (1820, 640), (1850, 651)]), soft=S(3), ragged=0.3))
        p.glaze(shore, hexc(C['shore']), 0.7, edge=0.4, gran=0.4)
        st('shore', True)

    # ================= water: sky colour at the horizon deepening toward us; reflections; ripples
    if 'water' in inc:
        p.rng = group_rng(seed, 'water')
        r = p.rng
        water = np.clip((YY - y0) / 3, 0, 1)
        p.glaze(water * np.exp(-(YY - y0) / S(200)), hexc(C['w_top']), C['w_top_k'], edge=0.0, gran=0.1, variation=0.15)
        st('water horizon')
        p.glaze(water * np.clip(0.1 + (YY - y0) / S(440), 0, 1) ** 1.2, hexc(C['w_deep']), 0.8, edge=0.0, gran=0.15, variation=0.2)
        st('water depth')
        p.glaze(p.mirror(far_m * (YY < y0), y0, soft=S(6), breakup=0.3), hexc(C['r_far']), 0.35, edge=0.05)
        st('reflect far')
        p.glaze(p.mirror(near_m * (YY < y0), y0, soft=S(6), breakup=0.35), hexc(C['r_near']), 0.55, edge=0.05)
        st('reflect near')
        p.glaze(p.mirror(allp * (YY < y0), y0, soft=S(5), breakup=0.5), hexc(C['r_pine']), 0.55, edge=0.05)
        st('reflect pines')
        p.glaze(p.mirror(glow, y0, soft=S(10), breakup=0.4), hexc(C['r_glow']), 0.3, edge=0.0)
        p.lift(p.mirror(glow, y0, soft=S(10), breakup=0.6), 0.3)
        st('reflect glow')
        n_rip = int(36 * (X1 - X0) / 1920 * (S.Y1 - Y0) / 440)
        batches = 3
        for b in range(batches):
            rip = []
            for _ in range(n_rip // batches):
                y = S.y(r.uniform(Y0 + 20, S.Y1 - 15)); x = S.x(r.uniform(X0 - 50, X1 - 120)); ln = r.uniform(S(100), S(380))
                rip.append(([(x, y), (x + ln, y + r.normal(0, S(1.5)))], max(1, r.uniform(S(2), S(3.5)))))
            p.lift(np.clip(bands(CH, CW, rip, S(1.2)), 0, 1), 0.28)
            st(f'ripples {b + 1}', b == batches - 1)

    # ================= mist: lifted, feathered band over the waterline, thicker on the left
    if 'mist' in inc:
        p.rng = group_rng(seed, 'mist')
        band = np.exp(-((YD - 648 - 30 * (p.noise(S(380), 3) - 0.5)) / 38) ** 2)
        band *= (0.5 + 0.5 * p.noise(S(150), 3)) * (0.4 + 0.6 * np.clip(1 - XD / 1500, 0, 1))
        p.lift(band * 0.55, C['mist'])
        st('mist 1')
        p.lift(band * 0.45, C['mist'])
        st('mist 2', True)

    # ================= boat, rower, oar and the boat's own reflection
    if 'boat' in inc:
        p.rng = group_rng(seed, 'boat')
        CX, CY = S.x(1170), S.y(800)
        hull = spline([(CX - S(92), CY - S(16)), (CX - S(55), CY + S(6)), (CX + S(55), CY + S(6)), (CX + S(94), CY - S(18)),
                       (CX + S(40), CY - S(9)), (CX - S(40), CY - S(9)), (CX - S(92), CY - S(16))], 10)
        hm = p.shape(hull, soft=S(1.2), ragged=0.1)
        p.glaze(hm, hexc(C['hull']), 0.95, edge=0.5, gran=0.25)
        p.stroke([(CX - S(84), CY - S(12)), (CX, CY - S(4)), (CX + S(86), CY - S(14))], S(2.2), hexc('#c99a6a'), 0.6, dry=0.3)
        st('hull')
        p.stroke(spline([(CX - S(10), CY - S(8)), (CX - S(7), CY - S(38))], 6), S(15), hexc(C['rower']), 0.9, dry=0.2, taper=(0.1, 0.2))
        p.glaze(p.shape(blob_pts(CX - S(6), CY - S(47), S(9), S(10), rough=0.05, seed=seed + 9), soft=S(1)), hexc('#e5ae8a'), 0.9, edge=0.3)
        st('rower')
        p.stroke(spline([(CX - S(30), CY - S(32)), (CX + S(30), CY - S(4)), (CX + S(70), CY + S(20))], 8), S(3), hexc('#5a3e2a'), 0.85, dry=0.2)
        st('oar')
        boat_m = np.maximum(hm, p.band([(CX - S(8), CY - S(8)), (CX - S(7), CY - S(56))], S(16), soft=S(1)))
        p.glaze(p.mirror(boat_m, CY + S(6), soft=S(4), breakup=0.45), hexc('#4a3a35'), 0.4, edge=0.1)
        p.lift(p.band([(CX - S(140), CY + S(12)), (CX + S(150), CY + S(10))], S(2.5), soft=S(1.2)), 0.5)
        st('boat reflection', True)

    # ================= birds: two small curved strokes each
    if 'birds' in inc:
        p.rng = group_rng(seed, 'birds')
        birds = [(1380, 250, 1.0), (1440, 222, 0.8), (1505, 262, 0.7), (1590, 205, 0.9), (1665, 242, 0.6)]
        for i, (bx, by, sc) in enumerate(birds):
            bx, by, sc = S.x(bx), S.y(by), sc * s
            p.stroke(curve((bx - 15 * sc, by), (bx, by + 2 * sc), -7 * sc, 8), S(2.6), hexc(C['bird']), 0.85, dry=0.15, taper=(0.1, 0.5))
            p.stroke(curve((bx, by + 2 * sc), (bx + 15 * sc, by - 2 * sc), -7 * sc, 8), S(2.6), hexc(C['bird']), 0.85, dry=0.15, taper=(0.5, 0.1))
            st(f'bird {i + 1}', i == len(birds) - 1)

    # ================= foreground reeds, lower-left
    if 'reeds' in inc:
        p.rng = group_rng(seed, 'reeds')
        r = p.rng
        bank = [(X0 - 20, S.Y1 + 20), (X0 - 20, 1036), (0, 1040), (120, 1030), (250, 1060), (290, S.Y1 + 20)]
        p.glaze(p.shape(S.pts(bank), soft=S(4), ragged=0.35), hexc(C['bank']), 0.5, edge=0.4, gran=0.3)
        st('bank')
        xa = min(-10, X0 + 10)
        n = int(55 * (300 - xa) / 310)
        batches = 4
        for b in range(batches):
            for _ in range(n // batches):
                xd = r.uniform(xa, 300)
                x = S.x(xd); yb = S.y(S.Y1 + 4)
                h = S(r.uniform(80, 190) * (1.1 - max(xd, 0) / 400) + (S.Y1 - 1080))
                lean = r.normal(S(6), S(10))
                p.stroke(spline([(x, yb), (x + lean * 0.4, yb - h * 0.5), (x + lean, yb - h)], 8), r.uniform(S(2), S(3.5)),
                         hexc(C['reeds'][int(r.integers(3))]), 0.75, dry=0.45, taper=(0.05, 0.8))
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
