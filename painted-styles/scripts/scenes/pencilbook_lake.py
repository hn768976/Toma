"""Mountain lake at dusk as a warm coloured-pencil picture-book page: every surface laid as fine strokes that follow
its form, in layers (light under-layer, local colour, shadow of the same family, warm and cool glazes), the warm
paper's tooth showing through. No ink lines, no black. Painted in the illustrator's order: paper -> sky (pines and
boat left white) -> far range -> near range -> pines -> water and reflections -> boat -> birds -> mist -> reeds."""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
import numpy as np

import drawkit
from drawkit import Scaler, seed_all, save_png

from pencilbook import PencilStorybook
from core import blur, spline, smoothstep, noise2d

STYLE = "Warm pencil storybook · 暖调彩铅绘本"
LIB = "pencilbook"

WL = 640.0
SUN = (1240, 560)
LIGHT = (0.55, -0.62, 0.45)          # low sun behind the far range, a little right of centre


def paint(W=1920, H=1080, seed=1, stages_dir=None):
    seed_all(seed)
    S = Scaler(W, H)
    s = S.s
    p = PencilStorybook(W, H, seed=seed, keep_stages=stages_dir is not None, stages_dir=stages_dir)
    p.finish()
    p.paper()
    p.stage('paper')
    rng = np.random.default_rng(seed + 404)
    sd = lambda: int(rng.integers(1 << 30))
    L = lambda a, b: (a * s, b * s)                  # stroke length / width ranges, scaled
    XX, YY = p.XX, p.YY
    wl = S(WL)

    # ------------------------------------------------------------------ plan: masks first, colour round them
    far_x = [-20, 140, 300, 450, 620, 790, 950, 1100, 1250, 1390, 1540, 1700, 1840, 1940]
    far_y = [392, 360, 338, 372, 330, 362, 344, 316, 296, 332, 318, 362, 344, 378]
    near_x = [-20, 110, 300, 480, 680, 880, 1040, 1200, 1340, 1480, 1640, 1800, 1940]
    near_y = [472, 440, 454, 430, 448, 488, 526, 558, 552, 586, 574, 604, 614]
    sx = lambda xs: [S(x) for x in xs]
    land = (YY < wl + 1).astype(np.float32)
    far = p.below(sx(far_x), sx(far_y)) * land
    near = p.below(sx(near_x), sx(near_y)) * land
    far_only = far * (1 - near)
    sky = (1 - far) * land

    PINES = [(70, 652, 200, 42), (140, 656, 236, 48), (215, 650, 182, 38), (285, 656, 214, 44), (352, 652, 160, 34),
             (412, 655, 140, 30), (470, 650, 112, 25), (522, 652, 92, 21),
             (1510, 646, 80, 18), (1572, 648, 110, 23), (1642, 645, 72, 16), (1752, 647, 94, 20)]

    def pine_pts(x, y0, h, hw):
        tiers = 5 if h > 120 else 4
        Lp, Rp = [], []
        top = y0 - h
        for k in range(tiers):
            t = (k + 1) / tiers
            yy = top + h * (0.05 + 0.85 * t)
            w = hw * (0.22 + 0.78 * t) * (1 + rng.normal(0, 0.05))
            yi = yy - h * 0.045
            Rp += [(x + w, yy), (x + w * 0.5, yi)] if k < tiers - 1 else [(x + w, yy)]
            Lp += [(x - w, yy), (x - w * 0.5, yi)] if k < tiers - 1 else [(x - w, yy)]
        return [(x, top)] + Rp + [(x + hw * 0.12, y0 - h * 0.08), (x + hw * 0.12, y0), (x - hw * 0.12, y0),
                                  (x - hw * 0.12, y0 - h * 0.08)] + Lp[::-1]

    pine_masks = [p.poly(S.pts(pine_pts(*pp))) for pp in PINES]
    pines = np.clip(sum(pine_masks), 0, 1)

    BX, BY, BL = 1170.0, 800.0, 180.0
    hull = p.poly(S.pts([(BX - BL / 2, BY - 24), (BX - BL / 2 + 20, BY - 4), (BX - 40, BY + 6), (BX + 50, BY + 6),
                         (BX + BL / 2 - 10, BY - 6), (BX + BL / 2 + 4, BY - 30), (BX, BY - 18)]), smooth=True)
    body = p.poly(S.pts([(BX - 30, BY - 14), (BX - 28, BY - 56), (BX - 12, BY - 70), (BX + 4, BY - 56), (BX + 4, BY - 14)]),
                  smooth=True)
    head = p.ellipse(S(BX - 12), S(BY - 84), S(12), S(13))
    oar = p.tube(S.pts([(BX - 2, BY - 50), (BX + 44, BY - 24), (BX + 92, BY + 12)]), S(5), S(4))
    boat = np.clip(hull + body + head + oar, 0, 1)
    fg = np.clip(pines + boat, 0, 1)
    water = (YY > wl).astype(np.float32)

    # ------------------------------------------------------------------ 1 sky
    sun = np.exp(-(((XX - S(SUN[0])) / S(620)) ** 2 + ((YY - S(SUN[1])) / S(300)) ** 2))
    v = np.clip(p.value(0.0, 1.0, 0, wl, 0.03) * (1 - 0.1 * sun) + 0.22 * sun, 0, 1)
    f = p.flow(-2, 4, S(400))
    p.hatch(sky, f, ('dusk_sky', v), L(70, 160), L(1.8, 2.7), 1.7, 0.78, avoid=fg, seed=sd())
    p.hatch(sky, p.rotate(f, -7), ('dusk_sky', np.clip(v + 0.05, 0, 1)), L(60, 140), L(1.8, 2.6), 1.3, 0.76,
            avoid=fg, seed=sd())
    p.hatch(sky * sun * 0.9, p.rotate(f, 4), ('glow', np.clip(1 - sun, 0, 1)), L(60, 140), L(1.8, 2.6), 1.2, 0.72,
            opacity=0.5, avoid=fg, seed=sd())
    # two thin lens clouds lit from below
    clouds = np.zeros((H, W), np.float32)
    for (cx, cy, cw, ch) in [(520, 170, 520, 26), (900, 240, 300, 16), (1580, 120, 420, 22), (260, 300, 260, 14)]:
        clouds = np.maximum(clouds, p.ellipse(S(cx), S(cy), S(cw / 2), S(ch)))
    clouds = blur(clouds, 3 * s) * sky
    under = blur(clouds * (1 - np.roll(clouds, -int(S(14)), 0)), 6 * s) * clouds
    p.hatch(clouds, f, ('lavender', 'mauve', 'powder'), L(40, 100), L(1.6, 2.4), 0.9, 0.7, alpha=0.5, avoid=fg,
            seed=sd())
    p.hatch(np.clip(under * 1.4, 0, 1), f, ('peach', 'apricot', 'butter'), L(40, 100), L(1.6, 2.4), 1.0, 0.72,
            opacity=0.5, alpha=0.6, avoid=fg, seed=sd())
    p.stage('sky')

    # ------------------------------------------------------------------ 2 far range: pale, hazy, low contrast
    far_l = p.shading(far_only, LIGHT, S(60), flat=0.45)
    p.form(far_only, ('lavender', 'periwinkle', 'mauve'), p.flow(-8, 16, S(200)), LIGHT, length=L(30, 70),
           width=L(1.6, 2.4), density=1.0, pressure=0.7, lit=far_l * 0.7 + 0.2, warm='peach', avoid=fg, seed=sd())
    haze = far_only * (0.45 + 0.55 * smoothstep(S(380), S(640), YY))
    p.lift(haze, 'cream', 0.42)
    p.stage('far_mountains')

    # ------------------------------------------------------------------ 3 near range: darker, slopes and gullies
    nf = p.blend(p.flow(-14, 16, S(220)), p.contour(near, S(30), 0), 0.35)
    near_l = p.shading(near, LIGHT, S(90), flat=0.2)
    p.form(near, ('periwinkle', 'slate', 'indigo', 'ultramarine'), nf, LIGHT, length=L(26, 60), width=L(1.6, 2.4),
           density=1.3, lit=near_l, warm='apricot', cool='violet', avoid=fg, seed=sd())
    gul = near * smoothstep(0.55, 0.75, noise2d(H, W, S(120), 3, sd())) * smoothstep(S(470), S(580), YY)
    p.hatch(gul, p.rotate(nf, 30), ('indigo', 'violet', 'slate'), L(20, 50), L(1.6, 2.2), 1.0, 0.78, alpha=0.55,
            avoid=fg, seed=sd())
    # a warm rim of sky light along the near ridge
    rim = near * smoothstep(S(14), 0, YY - p.line_y(sx(near_x), sx(near_y))[None])
    p.hatch(rim * (1 - fg), p.flow(-10, 8), ('glow', 'apricot', 'butter'), L(16, 40), L(1.4, 2.0), 1.0, 0.7,
            opacity=0.55, alpha=0.6, seed=sd())
    p.stage('near_mountains')

    # ------------------------------------------------------------------ 4 pines: each its own form, strokes down the boughs
    for (x, y0, h, hw), m in zip(PINES, pine_masks):
        cx = S(x)
        side = np.where(XX < cx, np.deg2rad(155), np.deg2rad(25)).astype(np.float32)
        bough = p.blend(side, np.full((H, W), np.deg2rad(90), np.float32), 0.25)
        p.form(m, ('sage', 'pine', 'forest', 'indigo'), bough, LIGHT, cross=14, length=L(10, 26), width=L(1.4, 2.1),
               density=1.4, warm='lichen', cool='violet', seed=sd())
        p.edge(m, 'forest', width=L(1.3, 1.9), length=L(10, 24), density=0.6, seed=sd())
    p.stage('trees')

    # ------------------------------------------------------------------ 5 water: mirrored picture in horizontal strokes
    src = p.C.copy()
    depth = np.clip((YY - wl) / S(440), 0, 1)
    p.reflect(wl, water * (1 - boat), src=src, ripple=7 * s, stretch=0.9, darken=0.1, tint='cornflower', mixw=0.18,
              length=L(40, 110), width=L(1.7, 2.5), density=1.8, pressure=0.76, opacity=0.38,
              field=p.flow(0, 3, S(300)), seed=sd())
    # the pines and the near range mirrored, darker, in short horizontal strokes
    ys = np.clip(2 * wl - YY, 0, H - 1).astype(int)
    pr = blur(pines[ys, XX.astype(int)] * water, 2.5 * s) * smoothstep(wl + S(230), wl + S(10), YY) * (1 - boat)
    p.reflect(wl, pr, src=src, ripple=5 * s, stretch=1.0, darken=0.3, tint='teal', mixw=0.2, length=L(16, 50),
              width=L(1.6, 2.3), density=1.9, pressure=0.8, opacity=0.5, seed=sd())
    nr = near[np.clip(wl - (YY - wl) / 0.9, 0, H - 1).astype(int), XX.astype(int)] * water * (1 - pr) * (1 - boat)
    p.hatch(nr * 0.7, p.flow(0, 2), ('indigo', 'slate', 'violet'), L(30, 90), L(1.6, 2.3), 1.0, 0.74, opacity=0.35,
            alpha=0.5, seed=sd())
    p.hatch(water * (0.25 + 0.75 * depth) * (1 - boat), p.flow(0, 3), ('cobalt', 'slate', 'indigo'), L(40, 120),
            L(1.6, 2.4), 1.2, 0.76, opacity=0.3, alpha=0.6, seed=sd())
    bands = smoothstep(0.55, 0.8, noise2d(H, W, S(14), 2, sd()) * 0.7 + 0.3 * noise2d(H, W, S(50), 2, sd()))
    p.hatch(water * bands * 0.7 * (1 - boat), p.flow(0, 2), ('cobalt', 'slate', 'teal'), L(30, 90), L(1.4, 2.0),
            0.8, 0.7, alpha=0.5, seed=sd())
    path_ = np.exp(-((XX - S(SUN[0])) / (S(70) + 0.45 * np.maximum(0, YY - wl))) ** 2) * smoothstep(S(960), wl, YY)
    p.hatch(water * path_ * (1 - boat) * (0.45 + 0.55 * smoothstep(0.4, 0.6, noise2d(H, W, S(10), 2, sd()))),
            p.flow(0, 2), ('sun', 'glow', 'apricot', 'butter'), L(20, 70), L(1.5, 2.2), 1.4, 0.74, opacity=0.65,
            alpha=0.7, seed=sd())
    p.stage('water')

    # ------------------------------------------------------------------ 6 boat and rower
    hl = p.form(hull, ('tan', 'sienna', 'brown', 'umber'), p.contour(hull, S(6), fallback=0), LIGHT,
                length=L(10, 24), width=L(1.4, 2.0), density=1.5, warm='apricot', seed=sd())
    p.form(body, ('cornflower', 'cobalt', 'indigo'), 80, LIGHT, length=L(8, 18), width=L(1.3, 1.9), density=1.5,
           seed=sd())
    p.form(head, ('skin', 'peach', 'skin_shade'), p.contour(head, S(4), fallback=0), LIGHT, length=L(6, 12),
           width=L(1.2, 1.7), density=1.6, seed=sd())
    p.form(oar, ('tan', 'brown', 'umber'), 30, LIGHT, length=L(8, 18), width=L(1.2, 1.7), density=1.5, seed=sd())
    p.line(S.pts([(BX - BL / 2 + 4, BY - 22), (BX, BY - 17), (BX + BL / 2, BY - 28)]), 'umber', 2.0 * s, 0.7, 0.7,
           seg=L(30, 60), wobble=0.6 * s, seed=sd())
    # its reflection and broken rings
    ys = np.clip(2 * S(BY + 4) - YY, 0, H - 1).astype(int)
    bm = np.clip(hull + body + head, 0, 1)[ys, XX.astype(int)] * water * (YY > S(BY + 4)) * (1 - boat)
    bm = blur(bm, 2.5 * s) * smoothstep(S(BY + 120), S(BY + 4), YY)
    p.reflect(np.full(W, S(BY + 4), np.float32), bm, src=p.C.copy(), ripple=5 * s, stretch=1.0, darken=0.3,
              tint='slate', mixw=0.25, length=L(14, 40), width=L(1.5, 2.1), density=1.7, pressure=0.78,
              opacity=0.45, seed=sd())
    p.ripples(S(BX), S(BY + 6), S(110), S(10), 3, 'cream', 1.8 * s, opacity=0.7, seed=sd())
    p.ripples(S(BX), S(BY + 9), S(118), S(11), 2, 'slate', 1.5 * s, opacity=0.35, seed=sd())
    p.stage('boat')

    # ------------------------------------------------------------------ 7 birds: a few soft pencil "v"s
    for (bx, by, sz) in [(1380, 250, 20), (1450, 210, 16), (1530, 268, 22), (1612, 196, 14), (1682, 240, 18)]:
        for sg in (-1, 1):
            p.line(S.pts([(bx + sg * sz, by - sz * 0.32), (bx + sg * sz * 0.48, by - sz * 0.5), (bx, by)]), 'indigo',
                   2.2 * s, 0.8, 0.85, seg=L(30, 60), wobble=0.3 * s, seed=sd())
    p.stage('birds')

    # ------------------------------------------------------------------ 8 mist: lifted paper and a few cream strokes
    mist = np.exp(-((YY - S(648)) / (S(28) + S(30) * (1 - XX / W))) ** 2) * (0.45 + 0.5 * (1 - XX / W))
    mist = mist * (0.75 + 0.25 * noise2d(H, W, S(160), 2, sd()))
    p.lift(mist, 'cream', 0.55, tooth=0.4)
    p.hatch(np.clip(mist * 1.1, 0, 1) * (1 - boat), p.flow(0, 3), ('cream', 'ivory', 'white'), L(60, 160),
            L(1.8, 2.6), 0.9, 0.72, opacity=0.6, alpha=0.55, seed=sd())
    p.stage('mist')

    # ------------------------------------------------------------------ 9 reeds in the lower-left corner
    corner = (XX < S(340)) * (YY > S(960)) * smoothstep(S(340), S(140), XX + 1.2 * (S(1080) - YY))
    corner = blur(corner.astype(np.float32), 6 * s)
    p.grass(corner, ('forest', 'moss', 'olive', 'pine'), height=L(120, 230), density=1.2, sway=12,
            width=L(1.6, 2.4), tuft=(3, 6), pressure=0.82, seed=sd())
    p.grass(corner * 0.8, ('ochre', 'sienna', 'olive'), height=L(70, 150), density=0.6, sway=16, width=L(1.5, 2.2),
            pressure=0.8, seed=sd())
    for k in range(22):
        x = rng.uniform(6, 300); h = rng.uniform(110, 220) * (1 - x / 520); lean = rng.normal(10, 9)
        path = S.pts([(x, 1086), (x + lean * 0.35, 1086 - h * 0.5), (x + lean, 1086 - h)])
        p.line(path, ['forest', 'olive', 'moss', 'sienna'][k % 4], rng.uniform(2.2, 3.2) * s, 0.84, 0.9,
               seg=L(60, 140), wobble=0.4 * s, taper=(0.1, 0.5), seed=sd())
    img = p.composite()
    if stages_dir:
        save_png(img, os.path.join(stages_dir, f'{p._n_stages:02d}_reeds_final.png'))
    return img


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else 'pencilbook_lake.png'
    W, H = (int(sys.argv[2]), int(sys.argv[3])) if len(sys.argv) > 3 else (1920, 1080)
    save_png(paint(W, H, stages_dir=os.environ.get('STAGES')), out)
