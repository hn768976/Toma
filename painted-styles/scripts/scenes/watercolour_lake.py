"""Mountain lake at dusk — Watercolour (水彩), painted with vendor lib/watercolor.py `Watercolor`.

python scripts/scenes/watercolour_lake.py out.png [W H]
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
import numpy as np

import drawkit
from drawkit import Scaler, seed_all, save_png
from watercolor import Watercolor, hexc
from core import blob_pts, spline, curve, fbm1d

STYLE = "Watercolour · 水彩"
LIB = "watercolor"

Y0 = 640   # waterline (design px)


def paint(W=1920, H=1080, seed=1, stages_dir=None):
    seed_all(seed)
    S = Scaler(W, H)
    s = S.s
    p = Watercolor(W, H, seed=seed)
    rng = p.rng
    YY, XX = p.YY, p.XX
    y0 = S(Y0)

    p.paper()
    p.stage('paper')

    # ---- dusk sky, wet-in-wet: violet-blue high, rose then peach at the horizon, glow behind the peak
    p.gradient_wash(0, y0 * 0.55, top=hexc('#6f78a8'), bottom=hexc('#c99bb0'), strength=0.55, soft_bottom=S(40), gran=0.1)
    low = np.clip((YY - y0 * 0.3) / (y0 * 0.7), 0, 1) * (YY < y0 + S(4))
    p.glaze(low, hexc('#f2a88c'), 0.5, edge=0.0, gran=0.08, variation=0.15)
    glow = np.exp(-(((XX - S(1240)) / S(330)) ** 2 + ((YY - S(560)) / S(200)) ** 2))
    p.lift(glow * (YY < y0), 0.45)
    p.glaze(glow * (YY < y0), hexc('#f7cf8e'), 0.35, edge=0.0, gran=0.1, variation=0.1)
    p.stage('sky')

    # ---- far range: pale, hazy lilac, irregular ridge with its highest peak near x=1250
    xs = np.linspace(0, 1920, 90)
    rough = fbm1d(90, 9, 4, seed + 11)
    far_y = (370 - 70 * np.exp(-((xs - 1250) / 170) ** 2) - 45 * np.exp(-((xs - 560) / 240) ** 2)
             - 30 * np.exp(-((xs - 1700) / 200) ** 2) + 18 * rough + 30 * np.exp(-((xs - 900) / 150) ** 2))
    far = [(0, Y0 + 4)] + [(x, y) for x, y in zip(xs, far_y)] + [(1920, Y0 + 4)]
    far_m = p.shape(S.pts(far), soft=S(10), ragged=0.35)
    p.glaze(far_m, hexc('#a08fb8'), 0.5, edge=0.3, gran=0.2, variation=0.25)
    # haze: lift the base of the far range so it melts into the glow
    p.lift(far_m * np.clip((YY - S(470)) / S(170), 0, 1), 0.45)
    p.stage('far mountains')

    # ---- near range: darker blue-green, big left shoulder, dipping to the right
    rough2 = fbm1d(90, 10, 4, seed + 21)
    near_y = (590 - 150 * np.exp(-((xs - 330) / 330) ** 2) - 90 * np.exp(-((xs - 820) / 220) ** 2)
              - 45 * np.exp(-((xs - 1700) / 200) ** 2) + 12 * rough2)
    near = [(0, Y0 + 4)] + [(x, y) for x, y in zip(xs, near_y)] + [(1920, Y0 + 4)]
    near_m = p.shape(S.pts(near), soft=S(5), ragged=0.3)
    p.glaze(near_m, hexc('#4f6a84'), 0.8, edge=0.55, gran=0.25, variation=0.3)
    shade = near_m * np.clip(1 - (XX - S(200)) / S(800), 0, 1) * np.clip((YY - S(470)) / S(160), 0, 1)
    p.glaze(p.soften(shade, S(14), 0.4), hexc('#33475a'), 0.45, edge=0.1, gran=0.2)
    p.stage('near mountains')

    # ---- pines: tiered triangular foliage glazed dark green over a trunk stroke
    pine_masks = []

    def pine(x, top, root, col='#2c4a40'):
        h = root - top
        p.stroke([(x, root), (x, top + h * 0.1)], max(1.5, h * 0.035), hexc('#4a3a2e'), 0.85, dry=0.25, taper=(0.02, 0.5))
        tiers = 5
        pts_all = []
        for k in range(tiers):
            f0 = k / tiers
            ty = top + h * (f0 * 0.82)
            by = top + h * min(1.0, (f0 + 0.32) * 0.88)
            half = h * (0.10 + 0.16 * (k + 1) / tiers)
            jit = lambda a: a + rng.normal(0, h * 0.012)
            pts_all.append([(jit(x), ty), (jit(x - half * 0.55), (ty + by) / 2), (jit(x - half), by),
                            (x, by - h * 0.03), (jit(x + half), by), (jit(x + half * 0.55), (ty + by) / 2)])
        m = np.zeros((H, W), np.float32)
        from core import polygon_mask
        for pts in pts_all:
            m = np.maximum(m, polygon_mask(H, W, pts, ss=2))
        m = p.soften(m, S(1.6), 0.3)
        p.glaze(m, hexc(col), 0.8, edge=0.7, gran=0.3, variation=0.35)
        # shadow side glaze pooled to the right, kept inside the crown
        sh = m * np.clip((XX - x) / (h * 0.15 + 1), 0, 1)
        p.glaze(p.soften(sh, S(4), 0.3) * m, hexc('#1c2e33'), 0.45, edge=0.1, gran=0.3)
        pine_masks.append(m)

    left = [(75, 470), (130, 430), (190, 500), (245, 420), (300, 475), (355, 520), (400, 455),
            (455, 540), (505, 560), (165, 545), (275, 555), (425, 585)]
    for (x, top) in left:
        pine(S(x + rng.normal(0, 4)), S(top), S(652), col=rng.choice(['#2c4a40', '#355544', '#2a4038']))
    for (x, top) in [(1520, 575), (1580, 545), (1640, 590), (1720, 565), (1785, 600)]:
        pine(S(x), S(top), S(650), col='#3a5550')
    shore = p.shape(S.pts([(0, 652), (0, 630), (200, 632), (540, 640), (600, 652)]), soft=S(3), ragged=0.3)
    shore = np.maximum(shore, p.shape(S.pts([(1470, 651), (1500, 641), (1820, 640), (1850, 651)]), soft=S(3), ragged=0.3))
    p.glaze(shore, hexc('#3b3a3a'), 0.7, edge=0.4, gran=0.4)
    p.stage('trees')

    # ---- the lake: sky colour at the horizon, deepening toward the viewer; mirrored mountains/pines
    water = np.clip((YY - y0) / 3, 0, 1)
    p.glaze(water * np.exp(-(YY - y0) / S(200)), hexc('#f0b08f'), 0.45, edge=0.0, gran=0.1, variation=0.15)
    p.glaze(water * np.clip(0.1 + (YY - y0) / S(440), 0, 1) ** 1.2, hexc('#46679a'), 0.8, edge=0.0, gran=0.15, variation=0.2)
    p.glaze(p.mirror(far_m * (YY < y0), y0, soft=S(6), breakup=0.3), hexc('#9a8fb5'), 0.35, edge=0.05)
    p.glaze(p.mirror(near_m * (YY < y0), y0, soft=S(6), breakup=0.35), hexc('#566a86'), 0.55, edge=0.05)
    allp = np.max(np.stack(pine_masks), 0) if pine_masks else np.zeros((H, W), np.float32)
    p.glaze(p.mirror(allp * (YY < y0), y0, soft=S(5), breakup=0.5), hexc('#2c4a40'), 0.55, edge=0.05)
    p.glaze(p.mirror(glow * (YY < y0), y0, soft=S(10), breakup=0.4), hexc('#f7cf8e'), 0.3, edge=0.0)
    p.lift(p.mirror(glow * (YY < y0), y0, soft=S(10), breakup=0.6), 0.3)
    rip = np.zeros((H, W), np.float32)
    for _ in range(36):
        y = rng.uniform(y0 + S(20), S(1065)); x = rng.uniform(-S(50), S(1800)); ln = rng.uniform(S(100), S(380))
        rip = np.maximum(rip, p.band([(x, y), (x + ln, y + rng.normal(0, S(1.5)))], max(1, rng.uniform(S(2), S(3.5))), soft=S(1.2)))
    p.lift(rip, 0.28)
    p.stage('water')

    # ---- wooden rowing boat with a seated rower, and its reflection
    CX, CY = S(1170), S(800)
    hull = spline([(CX - S(92), CY - S(16)), (CX - S(55), CY + S(6)), (CX + S(55), CY + S(6)), (CX + S(94), CY - S(18)),
                   (CX + S(40), CY - S(9)), (CX - S(40), CY - S(9)), (CX - S(92), CY - S(16))], 10)
    hm = p.shape(hull, soft=S(1.2), ragged=0.1)
    p.glaze(hm, hexc('#8a5a3a'), 0.95, edge=0.5, gran=0.25)
    p.stroke([(CX - S(84), CY - S(12)), (CX, CY - S(4)), (CX + S(86), CY - S(14))], S(2.2), hexc('#c99a6a'), 0.6, dry=0.3)
    p.stroke(spline([(CX - S(10), CY - S(8)), (CX - S(7), CY - S(38))], 6), S(15), hexc('#3e4a68'), 0.9, dry=0.2, taper=(0.1, 0.2))
    p.glaze(p.shape(blob_pts(CX - S(6), CY - S(47), S(9), S(10), rough=0.05, seed=seed + 9), soft=S(1)), hexc('#e5ae8a'), 0.9, edge=0.3)
    p.stroke(spline([(CX - S(30), CY - S(32)), (CX + S(30), CY - S(4)), (CX + S(70), CY + S(20))], 8), S(3), hexc('#5a3e2a'), 0.85, dry=0.2)
    boat_m = np.maximum(hm, p.band([(CX - S(8), CY - S(8)), (CX - S(7), CY - S(56))], S(16), soft=S(1)))
    p.glaze(p.mirror(boat_m, CY + S(6), soft=S(4), breakup=0.45), hexc('#4a3a35'), 0.4, edge=0.1)
    p.lift(p.band([(CX - S(140), CY + S(12)), (CX + S(150), CY + S(10))], S(2.5), soft=S(1.2)), 0.5)
    p.stage('boat')

    # ---- birds: two small curved strokes each
    for (bx, by, sc) in [(1380, 250, 1.0), (1440, 222, 0.8), (1505, 262, 0.7), (1590, 205, 0.9), (1665, 242, 0.6)]:
        bx, by, sc = S(bx), S(by), sc * s
        p.stroke(curve((bx - 15 * sc, by), (bx, by + 2 * sc), -7 * sc, 8), S(2.6), hexc('#3a3550'), 0.85, dry=0.15, taper=(0.1, 0.5))
        p.stroke(curve((bx, by + 2 * sc), (bx + 15 * sc, by - 2 * sc), -7 * sc, 8), S(2.6), hexc('#3a3550'), 0.85, dry=0.15, taper=(0.5, 0.1))
    p.stage('birds')

    # ---- mist: lifted, feathered band over the waterline, thicker on the left
    band = np.exp(-((YY - S(648) - S(30) * (p.noise(S(380), 3) - 0.5)) / S(38)) ** 2)
    band *= (0.5 + 0.5 * p.noise(S(150), 3)) * (0.4 + 0.6 * np.clip(1 - XX / S(1500), 0, 1))
    p.lift(band, 0.6)
    p.stage('mist')

    # ---- foreground reeds, lower-left
    bank = [(0, 1080), (0, 1040), (120, 1030), (250, 1060), (290, 1080)]
    p.glaze(p.shape(S.pts(bank), soft=S(4), ragged=0.35), hexc('#6b6a3c'), 0.5, edge=0.4, gran=0.3)
    for _ in range(55):
        x = rng.uniform(-S(10), S(300)); yb = S(1080) + S(4)
        h = rng.uniform(S(80), S(190)) * (1.1 - x / S(400))
        lean = rng.normal(S(6), S(10))
        p.stroke(spline([(x, yb), (x + lean * 0.4, yb - h * 0.5), (x + lean, yb - h)], 8), rng.uniform(S(2), S(3.5)),
                 hexc(rng.choice(['#4f5a2c', '#6d6a34', '#3c4628'])), 0.75, dry=0.45, taper=(0.05, 0.8))
    p.stage('reeds')

    img = p.composite().convert('RGB')
    if stages_dir:
        os.makedirs(stages_dir, exist_ok=True)
        for i, (name, im) in enumerate(p.stages):
            save_png(im, os.path.join(stages_dir, f"{i:02d}_{name.replace(' ', '_')}.png"))
    return img


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else 'watercolour_lake.png'
    W = int(sys.argv[2]) if len(sys.argv) > 2 else 1920
    H = int(sys.argv[3]) if len(sys.argv) > 3 else 1080
    save_png(paint(W, H), out)
    print('saved', out)
